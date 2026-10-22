import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
  };
};

function remarkInsertArticleAd() {
  return (tree: unknown) => {
    if (!tree || typeof tree !== "object" || !("children" in tree) || !Array.isArray(tree.children)) return;

    const children = tree.children as MarkdownNode[];
    const paragraphs = children.flatMap((node, index) => node.type === "paragraph" ? [index] : []);
    if (paragraphs.length < 2) return;

    const insertAfter = paragraphs[Math.ceil(paragraphs.length / 2) - 1];
    children.splice(insertAfter + 1, 0, {
      type: "paragraph",
      children: [],
      data: {
        hName: "div",
        hProperties: { className: "article-ad-slot-marker" },
      },
    });
  };
}

export default function MarkdownContent({ content, middleContent }: { content: string; middleContent?: ReactNode }) {
  return (
    <div className="article-markdown">
      <ReactMarkdown
        remarkPlugins={middleContent ? [remarkInsertArticleAd] : undefined}
        components={{
          a: ({ href, children, ...props }) => {
            const external = href?.startsWith("http://") || href?.startsWith("https://");
            return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...props}>{children}</a>;
          },
          img: ({ alt, src }) => src ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null,
          div: ({ className, children, ...props }) => className === "article-ad-slot-marker"
            ? middleContent ?? null
            : <div className={className} {...props}>{children}</div>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
