"use client";

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { useLocale } from "@/components/locale-provider";

function translateNode(node: ReactNode, translate: (text: string) => string): ReactNode {
  if (typeof node === "string") {
    const trimmed = node.trim();
    if (!trimmed) return node;
    const start = node.indexOf(trimmed);
    return `${node.slice(0, start)}${translate(trimmed)}${node.slice(start + trimmed.length)}`;
  }
  if (Array.isArray(node)) return Children.map(node, (child) => translateNode(child, translate));
  if (isValidElement<{ children?: ReactNode }>(node) && node.props.children !== undefined) {
    return cloneElement(node, {
      ...node.props,
      children: Children.map(node.props.children, (child) => translateNode(child, translate)),
    });
  }
  return node;
}

export default function LocalizedContent({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return <>{translateNode(children, t)}</>;
}
