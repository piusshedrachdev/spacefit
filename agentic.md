# Kimi K3 Agentic Shopping MVP

### 1-Hour Demo Implementation

## 1. Objective

Convert the existing Kimi K3 chat integration into a minimal **agentic shopping flow**.

The demo should prove that the model can:

1. Receive a user's shopping goal.
2. Decide which tool it needs.
3. Call the tool.
4. Receive the tool result.
5. Decide whether another tool call is necessary.
6. Repeat within a fixed limit.
7. Produce a final answer based on the actual tool results.

### Target demo

User:

> I have ₦500k to furnish my bedroom. Find me a bed, mattress and lamp.

Expected behavior:

```text
USER
  ↓
KIMI K3
  ↓
search_products("bed")
  ↓
product results
  ↓
KIMI K3
  ↓
search_products("mattress")
  ↓
product results
  ↓
KIMI K3
  ↓
search_products("lamp")
  ↓
product results
  ↓
KIMI K3
  ↓
FINAL RECOMMENDATION
```

This is the core feature.

---

# 2. Scope

## Build

* Kimi K3 API integration
* Function/tool definitions
* Agent loop
* `search_products` tool
* Optional `get_product` tool
* Mock product catalog
* Maximum agent-step limit
* Agent activity/status events
* Frontend integration
* Final recommendation

## Do NOT build during the first implementation

* LangChain
* LangGraph
* RAG
* Vector database
* Long-term memory
* Multi-agent architecture
* Browser automation
* Autonomous checkout
* Complex planning framework
* 10+ tools
* Production-grade orchestration

The objective is to prove the **agent loop**, not build an agent platform.

---

# 3. Architecture

```text
                    ┌───────────────┐
                    │     USER      │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   FRONTEND    │
                    └───────┬───────┘
                            │
                     POST /agent
                            │
                            ▼
                    ┌───────────────┐
                    │ AGENT SERVER  │
                    │               │
                    │ Agent Loop    │
                    │ Tool Registry │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    KIMI K3    │
                    └───────┬───────┘
                            │
                     tool_calls
                            │
                            ▼
                    ┌───────────────┐
                    │ TOOL REGISTRY │
                    └───────┬───────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              search_products   get_product
                     │             │
                     └──────┬──────┘
                            ▼
                       TOOL RESULT
                            │
                            ▼
                         KIMI K3
                            │
                    another tool?
                       /       \
                     yes        no
                      │          │
                      ▼          ▼
                   TOOL LOOP   RESPONSE
                                 │
                                 ▼
                               USER
```

---

# 4. Environment

The NVIDIA API key must live in an environment variable.

Do NOT hardcode it in source code.

Example:

```env
NVIDIA_API_KEY=your_key_here
```

Endpoint:

```text
https://integrate.api.nvidia.com/v1/chat/completions
```

Model:

```text
moonshotai/kimi-k3
```

For the first implementation use:

```json
{
  "stream": false
}
```

Streaming can be added after the agent loop works.

This makes debugging substantially easier because the entire assistant response, including any tool calls, is available at once.

---

# 5. Tool Definitions

Start with one essential tool.

## `search_products`

Purpose:

Search the product catalog according to the user's requirements.

Definition:

```javascript
const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the product catalog. Use this when the user needs products matching a category, query, or budget.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Product the user is looking for, such as bed, mattress, lamp, wardrobe."
          },
          max_price: {
            type: "number",
            description:
              "Maximum price the product should cost."
          }
        },
        required: ["query"]
      }
    }
  }
];
```

Optional second tool:

```javascript
{
  type: "function",
  function: {
    name: "get_product",
    description:
      "Get detailed information about a specific product.",
    parameters: {
      type: "object",
      properties: {
        product_id: {
          type: "string"
        }
      },
      required: ["product_id"]
    }
  }
}
```

Do not add additional tools until this works.

---

# 6. Mock Product Catalog

For the first demo, do not depend on the production database.

Create a simple in-memory catalog:

```javascript
const products = [
  {
    id: "bed-001",
    name: "Modern Queen Bed",
    category: "bed",
    price: 150000
  },
  {
    id: "bed-002",
    name: "Oak Platform Bed",
    category: "bed",
    price: 180000
  },
  {
    id: "mattress-001",
    name: "Orthopedic Mattress",
    category: "mattress",
    price: 120000
  },
  {
    id: "mattress-002",
    name: "Premium Foam Mattress",
    category: "mattress",
    price: 95000
  },
  {
    id: "lamp-001",
    name: "Minimal Bedside Lamp",
    category: "lamp",
    price: 35000
  },
  {
    id: "lamp-002",
    name: "Modern Table Lamp",
    category: "lamp",
    price: 45000
  }
];
```

Implementation:

```javascript
async function search_products({ query, max_price }) {
  const normalizedQuery = query.toLowerCase();

  return products.filter(product => {
    const matchesQuery =
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.category.toLowerCase().includes(normalizedQuery);

    const matchesPrice =
      max_price === undefined ||
      product.price <= max_price;

    return matchesQuery && matchesPrice;
  });
}
```

The real database can replace this later.

---

# 7. Tool Registry

Create a central registry:

```javascript
const toolHandlers = {
  search_products
};
```

Then:

```javascript
async function executeTool(name, args) {
  const handler = toolHandlers[name];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return await handler(args);
}
```

This is important because adding tools later becomes simple:

```javascript
const toolHandlers = {
  search_products,
  get_product,
  add_to_cart,
  get_cart
};
```

---

# 8. Agent System Prompt

Use a short system prompt.

Do not attempt to make the system prompt perform the agent loop itself.

Example:

```text
You are a shopping agent.

Your job is to help users find products that satisfy their
shopping goals and budget.

You have access to tools that provide real product information.

Use tools whenever product information is required.
Never invent products, prices, or availability.

Break complex shopping requests into smaller searches when necessary.

Continue using tools until you have enough information to provide
a useful recommendation.

When you have enough information, provide a concise final answer.
```

---

# 9. Agent Loop

This is the most important implementation.

```javascript
async function runAgent(userMessage) {

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  const MAX_STEPS = 6;

  for (let step = 0; step < MAX_STEPS; step++) {

    const response = await callKimi(messages, tools);

    const assistantMessage = response.choices[0].message;

    // IMPORTANT:
    // Preserve the complete assistant message.
    messages.push(assistantMessage);

    // No tool call means the model has finished.
    if (!assistantMessage.tool_calls?.length) {
      return {
        type: "final",
        content: assistantMessage.content
      };
    }

    for (const toolCall of assistantMessage.tool_calls) {

      const toolName = toolCall.function.name;

      const args =
        JSON.parse(toolCall.function.arguments);

      const result =
        await executeTool(toolName, args);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }

  return {
    type: "final",
    content:
      "I wasn't able to complete the shopping search within the allowed steps."
  };
}
```

## Important Kimi-K3 requirement

When continuing the conversation after a tool call, preserve the **complete assistant message returned by Kimi**.

Do not reconstruct it manually.

Use:

```javascript
messages.push(assistantMessage);
```

before adding the tool result.

This preserves information such as:

```text
reasoning_content
tool_calls
content
```

that Kimi may require for the next turn.

---

# 10. Calling Kimi

Create one function responsible for the API request:

```javascript
async function callKimi(messages, tools) {

  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Authorization":
          `Bearer ${process.env.NVIDIA_API_KEY}`,

        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        model: "moonshotai/kimi-k3",

        messages,

        tools,

        max_tokens: 4096,

        temperature: 1,

        reasoning_effort: "max",

        stream: false
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `NVIDIA API error ${response.status}: ${error}`
    );
  }

  return await response.json();
}
```

Do not expose the API key to the browser.

The frontend should communicate only with your backend.

---

# 11. Agent Endpoint

Expose:

```http
POST /agent
```

Request:

```json
{
  "message": "I have ₦500k to furnish my bedroom. Find me a bed, mattress and lamp."
}
```

Backend:

```javascript
app.post("/agent", async (req, res) => {

  try {

    const result =
      await runAgent(req.body.message);

    res.json(result);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Agent failed"
    });
  }
});
```

---

# 12. Agent Activity

For the demo, the UI should make the agent feel active.

Do NOT expose internal chain-of-thought.

Instead expose simple activity events.

For example:

```json
{
  "type": "tool_call",
  "tool": "search_products",
  "label": "Searching for beds..."
}
```

Then:

```json
{
  "type": "tool_result",
  "tool": "search_products",
  "label": "Found 2 beds"
}
```

Frontend could display:

```text
SpaceFit Agent

✓ Understanding your request

✓ Searching for beds
  2 products found

✓ Searching for mattresses
  2 products found

● Finding a bedside lamp...

```

These are **execution-status messages**, not the model's private reasoning.

---

# 13. API Rate Limit

Current available limit:

```text
40 requests per minute
```

The agent must therefore be bounded.

Use:

```javascript
const MAX_STEPS = 6;
```

Remember:

**One agent interaction can make multiple Kimi requests.**

Example:

```text
Request 1 → search bed
Request 2 → search mattress
Request 3 → search lamp
Request 4 → final answer
```

That's four API requests for one user interaction.

At 40 RPM, the theoretical maximum for a four-call interaction is approximately:

```text
40 / 4 = 10 interactions per minute
```

This is sufficient for a controlled demo.

Do not create an unbounded loop.

---

# 14. First Demo Scenario

Use exactly this test:

```text
I have ₦500k to furnish my bedroom.
I need a bed, mattress and bedside lamp.
```

Expected tool behavior:

```text
Kimi
 ↓
search_products
{
  "query": "bed"
}
 ↓
results
 ↓
Kimi
 ↓
search_products
{
  "query": "mattress"
}
 ↓
results
 ↓
Kimi
 ↓
search_products
{
  "query": "lamp"
}
 ↓
results
 ↓
Kimi
 ↓
final answer
```

The exact number/order of tool calls should **not be hardcoded**.

The model should decide what it needs.

---

# 15. Expected Final Response

Something approximately like:

```text
I found a bedroom setup within your ₦500k budget:

Modern Queen Bed — ₦150,000
Orthopedic Mattress — ₦120,000
Minimal Bedside Lamp — ₦35,000

Total: ₦305,000

You still have ₦195,000 remaining.
```

The important requirement is that these products and prices came from the tool results.

The model must not invent them.

---

# 16. Testing Checklist

### Test 1 — Simple search

```text
Find me a bed under ₦200k.
```

Expected:

```text
search_products
→ result
→ final response
```

### Test 2 — Multi-step request

```text
I have ₦500k to furnish my bedroom.
I need a bed, mattress and lamp.
```

Expected:

```text
multiple tool calls
→ multiple results
→ final recommendation
```

### Test 3 — No results

```text
Find me a bed under ₦10,000.
```

Expected:

```text
tool returns []
→ Kimi explains that no matching product was found
```

### Test 4 — Tool failure

Temporarily make `search_products` throw an error.

Expected:

```text
agent does not crash the server
→ useful error response
```

### Test 5 — Step limit

Force a scenario where the model keeps requesting tools.

Expected:

```text
MAX_STEPS reached
→ agent terminates safely
```

---

# 17. One-Hour Implementation Schedule

## 0–10 minutes

Set up:

```text
NVIDIA_API_KEY
POST /agent
callKimi()
```

Verify Kimi returns a normal response.

---

## 10–20 minutes

Implement:

```text
tools
search_products
toolHandlers
executeTool()
```

Use mock data.

---

## 20–35 minutes

Implement:

```text
runAgent()
```

Get this working:

```text
Kimi
→ tool call
→ tool execution
→ tool result
→ Kimi
→ final answer
```

---

## 35–45 minutes

Test multi-step requests.

Target:

```text
bed
→ mattress
→ lamp
→ final response
```

Fix tool/message formatting issues.

---

## 45–55 minutes

Connect the frontend.

Show:

```text
Searching...
Found...
Searching...
Found...
Recommendation...
```

---

## 55–60 minutes

Run the actual demo scenario.

Do not add new features.

---

# 18. Definition of Done

The implementation is successful if this works:

```text
User:
"I have ₦500k to furnish my bedroom.
I need a bed, mattress and lamp."

             ↓

        KIMI K3

             ↓

    search_products("bed")

             ↓

        TOOL RESULT

             ↓

        KIMI K3

             ↓

 search_products("mattress")

             ↓

        TOOL RESULT

             ↓

        KIMI K3

             ↓

  search_products("lamp")

             ↓

        TOOL RESULT

             ↓

        KIMI K3

             ↓

      FINAL RESPONSE
```

That is the MVP.

---

# 19. After the Demo

Once the loop works, the next tools can be added without changing the fundamental architecture:

```text
search_products
get_product
compare_products
calculate_total
add_to_cart
remove_from_cart
get_cart
```

Then the agent can eventually perform:

```text
understand goal
     ↓
search
     ↓
inspect products
     ↓
compare
     ↓
calculate budget
     ↓
recommend
     ↓
add to cart
     ↓
confirm with user
```

But those are **phase 2**.

For the current demo, the only thing that matters is proving:

> **The model can decide when to use a capability, your application executes that capability, the result goes back to the model, and the model can continue working toward the user's goal.**
