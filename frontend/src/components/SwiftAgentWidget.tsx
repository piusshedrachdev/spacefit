import { useEffect } from "react";

export default function SwiftAgentWidget() {
  useEffect(() => {
    const script = document.createElement("script");

    script.src = "https://widget.swiftagents.org/dist/widget-ui.js";

    script.setAttribute("data-company-id", "3e4d88fc-0c23-4d7b-895b-7b0e64a1ad3a");
    script.setAttribute(
      "data-api-key",
      "swa_live_b96b1fe6ad496e9beeaf3e99d0fbccaccac05c04ff075cc72c05a88deec24fc0"
    );

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}