/// <reference types="astro/client" />

declare namespace astroHTML.JSX {
  interface FormHTMLAttributes {
    /** WebMCP declarative API — https://webmachinelearning.github.io/webmcp/ */
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: boolean | string;
  }
}
