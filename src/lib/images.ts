// Image URLs (server/routes.mjs resizes and caches them) and the loader every <img> goes through.

export const img = {
  logo: (id: string, w = 320) => `/img/logo/${id}-${w}.webp`,
  symbol: (id: string) => `/img/symbol/${id}-64.webp`,
  card: (id: string, key: string, w = 240) => `/img/card/${id}/${encodeURIComponent(key)}-${w}.webp`,
  hd: (id: string, key: string) => `/img/card-hd/${id}/${encodeURIComponent(key)}-734.webp`,
};

// Our own lazy loading: native loading="lazy" lets each browser pick its lookahead (Chrome
// fetched 186 list images at the top of the page, 85 of them more than 3000 px down). This
// fetches about one screen ahead and behind, the same everywhere. An image hidden at some
// breakpoint never comes into view, so it never loads there.
const near = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const node = entry.target as HTMLImageElement;
      near.unobserve(node);
      if (node.dataset.src) node.src = node.dataset.src;
    }
  },
  { rootMargin: '100% 0px' },
);

/**
 * `use:load={{ src, eager }}`: eager images load at once, the rest when they come near. Either
 * way the image fades in once it has loaded (its box is reserved by width/height until then).
 */
export function load(node: HTMLImageElement, opts: { src: string; eager?: boolean }) {
  const shown = () => node.classList.add('in');
  const broken = () => node.classList.add('in', 'broken');
  node.addEventListener('load', shown);
  node.addEventListener('error', broken);

  const apply = ({ src, eager }: { src: string; eager?: boolean }) => {
    if (node.getAttribute('src') === src || node.dataset.src === src) return;
    node.classList.remove('in', 'broken');
    if (eager) {
      delete node.dataset.src;
      node.src = src;
    } else {
      node.removeAttribute('src');
      node.dataset.src = src;
      near.observe(node);
    }
  };
  apply(opts);

  return {
    update: apply,
    destroy() {
      near.unobserve(node);
      node.removeEventListener('load', shown);
      node.removeEventListener('error', broken);
    },
  };
}
