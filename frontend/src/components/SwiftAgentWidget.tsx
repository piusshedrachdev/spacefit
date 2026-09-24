import { useEffect } from "react";

export default function SwiftAgentWidget() {
  useEffect(() => {
    const script = document.createElement("script");

    script.src = "https://widget.swiftagents.org/dist/widget-ui.js";

    script.setAttribute("data-company-id", "3e4d88fc-0c23-4d7b-895b-7b0e64a1ad3a");
    script.setAttribute(
      "data-api-key",
      "swa_live_b678ddb78b510252023b6666a93c2130473004f2524dbda45da53d6bff947a41"
    );

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}