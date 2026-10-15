import ReactMarkdown from "react-markdown";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="article-markdown">
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }) => {
            const external = href?.startsWith("http://") || href?.startsWith("https://");
            return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...props}>{children}</a>;
          },
          img: ({ alt, src }) => src ? <img src={src} alt={alt ?? ""} loading="lazy" /> : null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
