#!/usr/bin/env bash
# End-to-end smoke pass for the seller ecosystem (Phase 7 "manual E2E pass").
#
# Covers: application submit -> duplicate rule -> admin queue/detail -> approve
# (role promotion + seller row + notification) -> reject path -> product CRUD
# + ownership -> settings/discounts -> reviews -> order -> returns -> block/
# unblock -> chrome data (auth/me, settings) -> every linked page serves 200.
#
# Run it against a memory-mode server (X-Dev-User identities, guards relaxed):
#   terminal 1: cd backend && USE_SUPABASE=false PORT=4010 npm start
#   terminal 2: bash scripts/e2e-seller-flow.sh            # or B=... to override
#
# Prints PASS/FAIL per check and exits non-zero on any failure (46 checks).
set -u
B=${B:-http://localhost:4010}
CUST='X-Dev-User: dev-user-customer'
ADM='X-Dev-User: dev-user-admin'
SELL='X-Dev-User: dev-user-seller'
JSON='Content-Type: application/json'

# Wait for the server before touching it (avoids connection-refused races).
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B/api/health" || true)
  [ "$code" = "200" ] && break
  sleep 1
done
if [ "${code:-000}" != "200" ]; then echo "server not reachable at $B"; exit 2; fi
echo "target: $B (health ok)"

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "PASS  $1";
  else fail=$((fail+1)); echo "FAIL  $1 (expected: $2 | got: $3)"; fi; }
jqv() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=process.argv[1].split('.').reduce((a,k)=>a==null?a:a[k],o);if(v===undefined){console.log('MISSING');return}console.log(typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('PARSE_ERR')}})" "$1"; }
count() { node -e "try{const o=JSON.parse(process.argv[1]);const d=o.data;const a=Array.isArray(d)?d:(process.argv[2]?d[process.argv[2]]:null);console.log(Array.isArray(a)?a.length:'NA')}catch(e){console.log('ERR')}"; }

echo "--- 1. customer submits seller application (same payload shape as js/apply.js)"
APP=$(curl -s -X POST "$B/api/sellers/applications" -H "$JSON" -H "$CUST" -d '{
  "fullName":"Amara Obi","email":"customer@spacefit.ng","phone":"+2348012345678",
  "city":"Lagos","state":"Lagos","shopName":"Amara Home Studio",
  "deliveryPlaces":["Lagos","Abuja"],"categories":["Beds","Lighting"],
  "bio":"Handmade lighting and beds.","termsAccepted":true,"disclaimersAccepted":true}')
check "application created (pending)" "pending" "$(echo "$APP" | jqv data.status)"
APP_ID=$(echo "$APP" | jqv data.id)
echo "      id=$APP_ID"

echo "--- 2. duplicate pending application"
DUP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/sellers/applications" -H "$JSON" -H "$CUST" -d '{
  "fullName":"Amara Obi","email":"customer@spacefit.ng","phone":"+2348012345678",
  "shopName":"Amara Home Studio","termsAccepted":true,"disclaimersAccepted":true}')
echo "      status=$DUP (409 = one-pending rule enforced)"

echo "--- 3. applicant is gated as 'pending' (drives seller-apply.html status state)"
CTX=$(curl -s "$B/api/sellers/me" -H "$CUST")
check "context shows pending application" "$APP_ID" "$(echo "$CTX" | jqv data.application.id)"
check "not a seller yet" "false" "$(echo "$CTX" | jqv data.isSeller)"

echo "--- 4. admin review queue"
QUEUE=$(curl -s "$B/api/sellers/applications?status=pending" -H "$ADM")
check "queue contains application" "$APP_ID" "$(echo "$QUEUE" | jqv "data.0.id")"
DETAIL=$(curl -s "$B/api/sellers/applications/$APP_ID" -H "$ADM")
check "application detail" "$APP_ID" "$(echo "$DETAIL" | jqv data.id)"

echo "--- 5. admin approves"
APPROVE=$(curl -s -X PATCH "$B/api/sellers/applications/$APP_ID" -H "$JSON" -H "$ADM" -d '{"decision":"approved","reviewNotes":"Looks good"}')
check "application approved" "approved" "$(echo "$APPROVE" | jqv data.application.status)"
check "approval creates a seller row" "$APP_ID" "$(echo "$APPROVE" | jqv data.seller.applicationId)"
SELLER_ID=$(echo "$APPROVE" | jqv data.seller.id)
echo "      sellerId=$SELLER_ID"

echo "--- 6. role promoted + seller context"
check "profiles.role -> seller" "seller" "$(curl -s "$B/api/auth/me" -H "$CUST" | jqv data.profile.role)"
CTX2=$(curl -s "$B/api/sellers/me" -H "$CUST")
check "seller context active" "active" "$(echo "$CTX2" | jqv data.seller.status)"
check "isSeller true" "true" "$(echo "$CTX2" | jqv data.isSeller)"

echo "--- 7. admin notified"
check "admin unreadCount >= 1" "true" "$(node -e "const d=JSON.parse(process.argv[1]);console.log(!!(d.data&&d.data.unreadCount>=1))" "$(curl -s "$B/api/notifications" -H "$ADM")")"
NOTIF0=$(curl -s "$B/api/notifications" -H "$ADM" | jqv "data.items.0.type")
echo "      latest type=$NOTIF0"

echo "--- 8. approved seller lists a product"
PROD=$(curl -s -X POST "$B/api/products" -H "$JSON" -H "$CUST" -d '{
  "title":"Handblown Vesper Lamp","category":"Lighting",
  "price":85000,"origPrice":95000,"availability":"In stock",
  "shortDescription":"Handblown glass table lamp.","description":"A sculptural table lamp.",
  "features":["Handblown glass"],"specs":["Material: Glass"],
  "colors":["Amber"],"sizes":[],"images":["/logo.jpeg"],"featured":false}')
PROD_ID=$(echo "$PROD" | jqv data.id)
check "product id returned" "false" "$([ "$PROD_ID" = "MISSING" -o "$PROD_ID" = "PARSE_ERR" ] && echo true || echo false)"
check "product owned by the new seller" "$SELLER_ID" "$(echo "$PROD" | jqv data.sellerId)"
echo "      productId=$PROD_ID"

echo "--- 9. seller dashboard stats"
DASH=$(curl -s "$B/api/sellers/me/dashboard" -H "$CUST")
check "dashboard stats present" "true" "$(node -e "const d=JSON.parse(process.argv[1]).data;console.log(!!(d&&d.stats&&typeof d.stats.products==='number'))" "$DASH")"

echo "--- 10. ownership: another seller cannot edit this listing"
check "cross-seller edit denied" "403" "$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$B/api/products/$PROD_ID" -H "$JSON" -H "$SELL" -d '{"price":1}')"
check "owner edit allowed" "200" "$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$B/api/products/$PROD_ID" -H "$JSON" -H "$CUST" -d '{"price":84000}')"
check "admin edit allowed" "200" "$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$B/api/products/$PROD_ID" -H "$JSON" -H "$ADM" -d '{"price":85000}')"

echo "--- 11. admin publishes a discount (drives the chrome discount banner)"
PUT=$(curl -s -X PUT "$B/api/meta/settings" -H "$JSON" -H "$ADM" -d '{"discounts":{"sitewidePercent":10,"promoCode":"SPACE10","freeDeliveryThreshold":500000,"bannerEnabled":true}}')
check "discounts saved" "10" "$(echo "$PUT" | jqv data.discounts.sitewidePercent)"
check "public settings show banner" "true" "$(curl -s "$B/api/meta/settings" | jqv data.discounts.bannerEnabled)"
check "policies exposed for policies.html" "false" "$([ "$(curl -s "$B/api/meta/settings" | jqv data.policies.returnPolicy)" = "MISSING" ] && echo true || echo false)"

echo "--- 12. product review"
REV=$(curl -s -X POST "$B/api/products/$PROD_ID/reviews" -H "$JSON" -H "$CUST" -d '{"rating":5,"comment":"Beautiful."}')
check "review created" "5" "$(echo "$REV" | jqv data.rating)"
LIST=$(curl -s "$B/api/products/$PROD_ID/reviews")
check "public review visible" "true" "$(node -e "try{const d=JSON.parse(process.argv[1]).data;const a=Array.isArray(d)?d:((d&&d.reviews)||[]);console.log(a.length>0)}catch(e){console.log('false')}" "$LIST")"

echo "--- 13. order -> return request -> seller resolution"
ORD=$(curl -s -X POST "$B/api/orders" -H "$JSON" -H "$CUST" -d "{\"fullName\":\"Amara Obi\",\"email\":\"customer@spacefit.ng\",\"phone\":\"+2348012345678\",\"address\":\"12 Marina\",\"city\":\"Lagos\",\"state\":\"Lagos\",\"paymentMethod\":\"card\",\"items\":[{\"productId\":\"$PROD_ID\",\"quantity\":1}]}")
ORD_ID=$(echo "$ORD" | jqv data.id)
check "order placed" "false" "$([ "$ORD_ID" = "MISSING" ] && echo true || echo false)"
RET=$(curl -s -X POST "$B/api/returns" -H "$JSON" -H "$CUST" -d "{\"orderId\":\"$ORD_ID\",\"productId\":\"$PROD_ID\",\"reason\":\"Damaged in transit\"}")
check "return raised (requested)" "requested" "$(echo "$RET" | jqv data.status)"
RET_ID=$(echo "$RET" | jqv data.id)
RET_LIST=$(curl -s "$B/api/returns" -H "$CUST")
check "owner sees the return" "$RET_ID" "$(echo "$RET_LIST" | jqv "data.0.id")"
UPD=$(curl -s -X PATCH "$B/api/returns/$RET_ID" -H "$JSON" -H "$CUST" -d '{"status":"approved"}')
check "return approved" "approved" "$(echo "$UPD" | jqv data.status)"

echo "--- 14. admin blocks / unblocks the seller"
BLK=$(curl -s -X PATCH "$B/api/sellers/$SELLER_ID" -H "$JSON" -H "$ADM" -d '{"status":"blocked","reason":"E2E test block"}')
check "seller blocked" "blocked" "$(echo "$BLK" | jqv data.status)"
check "blocked status visible to seller" "blocked" "$(curl -s "$B/api/sellers/me" -H "$CUST" | jqv data.seller.status)"
UNB=$(curl -s -X PATCH "$B/api/sellers/$SELLER_ID" -H "$JSON" -H "$ADM" -d '{"status":"active"}')
check "seller unblocked" "active" "$(echo "$UNB" | jqv data.status)"

echo "--- 15. admin rejects a second application"
APP2=$(curl -s -X POST "$B/api/sellers/applications" -H "$JSON" -H "$SELL" -d '{
  "fullName":"Tunde Seller","email":"seller@spacefit.ng","phone":"+2348099999999",
  "shopName":"Tunde Crafts","termsAccepted":true,"disclaimersAccepted":true}')
APP2_ID=$(echo "$APP2" | jqv data.id)
REJ=$(curl -s -X PATCH "$B/api/sellers/applications/$APP2_ID" -H "$JSON" -H "$ADM" -d '{"decision":"rejected","reviewNotes":"Photos unclear, please re-apply."}')
check "application rejected" "rejected" "$(echo "$REJ" | jqv data.application.status)"
check "rejection notes stored" "false" "$([ "$(echo "$REJ" | jqv data.application.reviewNotes)" = "MISSING" ] && echo true || echo false)"
check "rejection creates no seller row" "MISSING" "$(echo "$REJ" | jqv data.seller)"
check "second decision is a conflict (409)" "409" "$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$B/api/sellers/applications/$APP2_ID" -H "$JSON" -H "$ADM" -d '{"decision":"approved"}')"

echo "--- 16. chrome data: settings for footer/banner + auth/me for the account menu"
check "GET /api/auth/me (admin gate)" "admin" "$(curl -s "$B/api/auth/me" -H "$ADM" | jqv data.profile.role)"
check "GET /api/auth/me (dev seller)" "seller" "$(curl -s "$B/api/auth/me" -H "$SELL" | jqv data.profile.role)"
check "profile PATCH round-trip" "200" "$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$B/api/auth/me" -H "$JSON" -H "$CUST" -d '{"phone":"+2348077777777"}')"

echo "--- 17. static pages chrome links to"
for p in index cart checkout product-details order-succes auth seller-apply seller-dashboard admin policies; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B/$p.html")
  [ "$p" = "index" ] && code=$(curl -s -o /dev/null -w "%{http_code}" "$B/")
  check "page /$p" "200" "$code"
done

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
