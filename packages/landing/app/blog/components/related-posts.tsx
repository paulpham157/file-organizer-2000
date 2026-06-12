import Link from "next/link";
import { BlogPost } from "@/types/blog";
import { ArrowRight } from "lucide-react";

interface RelatedPostsProps {
  posts: BlogPost[];
}

export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Related reading</h2>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="group flex items-start justify-between gap-4 rounded-md p-3 -mx-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                  {post.title}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {post.excerpt}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 mt-1 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
