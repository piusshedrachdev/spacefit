/**
 * Tailwind tokens ported verbatim from the legacy Tailwind-CDN config
 * (the pre-migration frontend/legacy/index.html, id="tailwind-config";
 * deleted at cutover — this file is now the source of truth).
 */
const tokens = {
  "darkMode": "class",
  "theme": {
    "extend": {
      "colors": {
        "surface-container-high": "#eae8e5",
        "surface-bright": "#fbf9f6",
        "surface-container-lowest": "#ffffff",
        "on-error": "#ffffff",
        "on-secondary-fixed-variant": "#6e3900",
        "primary-fixed-dim": "#ffb694",
        "on-primary": "#ffffff",
        "surface-variant": "#e4e2df",
        "on-primary-fixed": "#351000",
        "tertiary-fixed": "#e9e1df",
        "on-surface-variant": "#54433c",
        "surface-dim": "#dbdad7",
        "background": "#fbf9f6",
        "primary-fixed": "#ffdbcc",
        "primary": "#914720",
        "on-secondary": "#ffffff",
        "on-secondary-fixed": "#2f1500",
        "inverse-surface": "#30312f",
        "surface-tint": "#944922",
        "error": "#ba1a1a",
        "on-tertiary-fixed-variant": "#4b4644",
        "on-primary-fixed-variant": "#76330d",
        "inverse-primary": "#ffb694",
        "on-tertiary": "#ffffff",
        "on-error-container": "#93000a",
        "on-background": "#1b1c1a",
        "error-container": "#ffdad6",
        "outline-variant": "#dac1b7",
        "tertiary-container": "#797372",
        "tertiary": "#605b59",
        "secondary-fixed": "#ffdcc3",
        "secondary": "#904d00",
        "surface-container-highest": "#e4e2df",
        "on-tertiary-container": "#fffbff",
        "on-surface": "#1b1c1a",
        "outline": "#87736a",
        "tertiary-fixed-dim": "#cdc5c3",
        "secondary-fixed-dim": "#ffb77d",
        "surface-container-low": "#f5f3f0",
        "secondary-container": "#fe932c",
        "on-secondary-container": "#663500",
        "primary-container": "#b05f36",
        "surface-container": "#efeeeb",
        "on-primary-container": "#fffbff",
        "surface": "#fbf9f6",
        "inverse-on-surface": "#f2f0ed",
        "on-tertiary-fixed": "#1e1b1a"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "space-2xl": "4rem",
        "margin-mobile": "1rem",
        "gutter-sm": "1rem",
        "margin": "2rem",
        "space-lg": "1.5rem",
        "space-xs": "0.25rem",
        "gutter": "1.5rem",
        "space-md": "1rem",
        "margin-desktop": "4rem",
        "gutter-lg": "2rem",
        "space-xl": "2.5rem",
        "space-sm": "0.5rem"
      },
      "fontFamily": {
        "headline-sm": [
          "Plus Jakarta Sans"
        ],
        "label-lg": [
          "Plus Jakarta Sans"
        ],
        "headline-lg": [
          "Playfair Display"
        ],
        "label-md": [
          "Plus Jakarta Sans"
        ],
        "price-md": [
          "Plus Jakarta Sans"
        ],
        "body-md": [
          "Plus Jakarta Sans"
        ],
        "label-sm": [
          "Plus Jakarta Sans"
        ],
        "price-lg": [
          "Plus Jakarta Sans"
        ],
        "body-lg": [
          "Plus Jakarta Sans"
        ],
        "display-lg": [
          "Playfair Display"
        ],
        "display-lg-mobile": [
          "Playfair Display"
        ],
        "headline-lg-mobile": [
          "Playfair Display"
        ],
        "body-sm": [
          "Plus Jakarta Sans"
        ],
        "headline-md": [
          "Playfair Display"
        ]
      },
      "fontSize": {
        "headline-sm": [
          "18px",
          {
            "lineHeight": "26px",
            "fontWeight": "600"
          }
        ],
        "label-lg": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "600"
          }
        ],
        "headline-lg": [
          "32px",
          {
            "lineHeight": "40px",
            "fontWeight": "600"
          }
        ],
        "label-md": [
          "12px",
          {
            "lineHeight": "16px",
            "fontWeight": "600"
          }
        ],
        "price-md": [
          "16px",
          {
            "lineHeight": "22px",
            "fontWeight": "700"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "22px",
            "fontWeight": "400"
          }
        ],
        "label-sm": [
          "11px",
          {
            "lineHeight": "14px",
            "fontWeight": "600"
          }
        ],
        "price-lg": [
          "22px",
          {
            "lineHeight": "28px",
            "fontWeight": "700"
          }
        ],
        "body-lg": [
          "16px",
          {
            "lineHeight": "26px",
            "fontWeight": "400"
          }
        ],
        "display-lg": [
          "48px",
          {
            "lineHeight": "56px",
            "fontWeight": "600"
          }
        ],
        "display-lg-mobile": [
          "34px",
          {
            "lineHeight": "42px",
            "fontWeight": "600"
          }
        ],
        "headline-lg-mobile": [
          "26px",
          {
            "lineHeight": "32px",
            "fontWeight": "600"
          }
        ],
        "body-sm": [
          "12px",
          {
            "lineHeight": "18px",
            "fontWeight": "400"
          }
        ],
        "headline-md": [
          "24px",
          {
            "lineHeight": "32px",
            "fontWeight": "500"
          }
        ]
      }
    }
  }
};

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  ...tokens
};
