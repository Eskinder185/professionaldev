import React, { PropsWithChildren } from "react";

export default function Card({ children, className="" }: PropsWithChildren<{className?:string}>) {
  return <div className={`surface p-5 hover-glow ${className}`}>{children}</div>;
}