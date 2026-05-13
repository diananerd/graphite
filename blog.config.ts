/**
 * blog.config.ts — Brand & content configuration
 *
 * All site-specific branding lives here. Fork this repo, edit this file,
 * and the entire blog rebrands. Source code in src/ and worker/ stays generic.
 */

export interface BlogConfig {
  site: {
    /** Title shown in the header and as <title> on the home page */
    name: string;
    /** Default page description (fallback when post has no `description`) */
    description: string;
    /** Production domain, no protocol */
    domain: string;
    /** Full origin URL, no trailing slash */
    url: string;
    /** HTML lang attribute */
    lang: string;
    /** Author shown in RSS, meta tags, and footer */
    author: {
      name: string;
      email?: string;
      url?: string;
    };
    /** Optional links rendered in the footer */
    socials?: Array<{ label: string; href: string }>;
  };

  /** Terminal-style prompt rendered in the header */
  terminal: {
    /** e.g. "diana@nerd:~$" */
    prompt: string;
  };

  /** Cloudflare resource names */
  cloudflare: {
    /** Worker script name (must match wrangler.jsonc) */
    workerName: string;
    /** R2 bucket name for image originals */
    r2BucketName: string;
    /** R2 preview bucket (used by `wrangler dev`) */
    r2PreviewBucketName: string;
  };

  /** Open Graph image generation settings */
  og: {
    /** Tagline rendered on the home OG card */
    tagline: string;
  };
}

export const blogConfig: BlogConfig = {
  site: {
    name: "Diana Nerd",
    description: "Diana's Blog",
    domain: "diananerd.com",
    url: "https://diananerd.com",
    lang: "es",
    author: {
      name: "Diana Nerd",
      email: "diananerdoficial@gmail.com",
    },
    socials: [
      { label: "github", href: "https://github.com/diananerd" },
    ],
  },
  terminal: {
    prompt: "diana@nerd:~$",
  },
  cloudflare: {
    workerName: "graphite",
    r2BucketName: "graphite-images",
    r2PreviewBucketName: "graphite-images-preview",
  },
  og: {
    tagline: "Diana's Blog",
  },
};

export default blogConfig;
