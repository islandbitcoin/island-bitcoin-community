/// <reference types="vite/client" />

declare module "*.svg?react" {
  import React from "react";
  const SVGComponent: React.VFC<React.SVGProps<SVGSVGElement> & { title?: string }>;
  export default SVGComponent;
}
