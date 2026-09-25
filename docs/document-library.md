# SpaceFit AI Knowledge Base

This directory contains answer-ready Markdown knowledge for a SpaceFit customer-support and CRM AI agent. These are knowledge documents, not website upload controls and not a live document-storage feature.

## Files to give the AI agent

| File | Use |
| --- | --- |
| `faq-documents.md` | Customer FAQ questions and answers about accounts, products, checkout, delivery, returns, sellers, saved products, consultations, and support escalation. |
| `policies-for-ai.md` | Policy language for returns, seller obligations, delivery, privacy, checkout, and escalation. |
| `manuals.md` | Current manual-status note and safe product-guidance rules. It does not contain invented product manuals. |
| `crm-agent-instructions.md` | Optional agent instructions for safe, useful, escalation-aware responses. |

## Recommended upload order

1. Use `crm-agent-instructions.md` as the agent's system instructions, if the AI platform supports a separate system-prompt field.
2. Upload `faq-documents.md` and `policies-for-ai.md` as the customer knowledge base.
3. Add `manuals.md` only when the business has approved product manuals. Replace its placeholder status with the real manual files or links.
4. Keep internal staff procedures in a separate restricted knowledge base. Do not give internal SOPs to a customer-facing agent.

## Content status

- FAQ and policy content is based on the current SpaceFit application and its default settings.
- Prices, stock, delivery charges, discounts, payment availability, and order states are dynamic. The agent must use live business data or escalate instead of relying on an old answer.
- The policy document is a draft for business-owner and legal review. It must not be presented as final legal advice until approved.
- No password, one-time code, payment-card number, CVV, bank password, or secret key should ever be placed in these files.
