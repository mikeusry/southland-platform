import { json, type LoaderFunctionArgs } from "@remix-run/node";
import type { NavItem } from "@southland/ui-schema";

const SHOPIFY_DOMAIN = "https://southlandorganics.com";
const PODCAST_PATHS = ["/podcast"];
const SHOP_DOMAIN = process.env.SHOP_DOMAIN || "southland-organics.myshopify.com";
const STOREFRONT_TOKEN = process.env.STOREFRONT_TOKEN!;

const LAYOUT_QUERY = `
  query GetLayoutData {
    menu(handle: "main-menu") {
      items {
        title
        url
        items {
          title
          url
        }
      }
    }
    footerMenu: menu(handle: "footer") {
      items {
        title
        url
        items {
          title
          url
        }
      }
    }
    shop {
      name
      brand {
        logo {
          image {
            url
          }
        }
      }
    }
  }
`;

interface ShopifyMenuItem {
  title: string;
  url: string | null;
  items?: ShopifyMenuItem[];
}

function normalizeUrl(url: string | null): string {
  if (!url) return "#";

  // Already absolute
  if (url.startsWith("http")) {
    // Check if it's a Shopify URL pointing to podcast (make relative)
    const podcastMatch = url.match(/southlandorganics\.com(\/podcast.*)/);
    if (podcastMatch) return podcastMatch[1];
    return url;
  }

  // Relative URL
  if (url.startsWith("/")) {
    // Podcast paths stay relative (served by Astro)
    if (PODCAST_PATHS.some(p => url.startsWith(p))) {
      return url;
    }
    // Everything else → Shopify
    return `${SHOPIFY_DOMAIN}${url}`;
  }

  return url;
}

function transformMenuItem(item: ShopifyMenuItem): NavItem {
  return {
    label: item.title,
    href: normalizeUrl(item.url),
    children: item.items?.length
      ? item.items.map(child => ({
          label: child.title,
          href: normalizeUrl(child.url),
        }))
      : undefined,
  };
}

function transformFooterToColumns(items: ShopifyMenuItem[]) {
  return items.map(item => ({
    title: item.title,
    links: item.items?.map(child => ({
      label: child.title,
      href: normalizeUrl(child.url),
    })) || [],
  }));
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await fetch(
      `https://${SHOP_DOMAIN}/api/2024-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query: LAYOUT_QUERY }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Storefront API error:", response.status, text);
      throw new Error(`Storefront API error: ${response.status}`);
    }

    const { data, errors } = await response.json();

    if (errors) {
      console.error("GraphQL errors:", errors);
      throw new Error("GraphQL query failed");
    }

    const layoutData = {
      _meta: {
        synced: new Date().toISOString(),
        source: "Shopify Storefront API + Menus",
      },
      header: {
        logoUrl: data.shop?.brand?.logo?.image?.url ||
          "https://southlandorganics.com/cdn/shop/files/Southland_Organics_Horizontal.svg",
        logoAlt: data.shop?.name || "Southland Organics",
        navigation: data.menu?.items?.map(transformMenuItem) || [],
      },
      footer: {
        columns: transformFooterToColumns(data.footerMenu?.items || []),
        copyright: `© ${new Date().getFullYear()} Southland Organics. All rights reserved.`,
        socialLinks: [
          { platform: "facebook", url: "https://facebook.com/southlandorganics", icon: "facebook" },
          { platform: "instagram", url: "https://instagram.com/southlandorganics", icon: "instagram" },
          { platform: "youtube", url: "https://youtube.com/@southlandorganics", icon: "youtube" },
        ],
      },
    };

    return json(layoutData, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Layout API error:", error);
    return json(
      { error: "Failed to fetch layout data", details: String(error) },
      { status: 500 }
    );
  }
}
