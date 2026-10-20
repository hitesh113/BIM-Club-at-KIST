import { useState, type SyntheticEvent } from "react";
import "./ImageAccordion.css";

export interface AccordionItem {
  /** Stable unique key. */
  id: string;
  /** Caption shown on the panel (also the button's accessible name). */
  title: string;
  /** Image URL. */
  image: string;
  /** Alt text. Leave empty (default) when the caption already describes the image. */
  alt?: string;
}

export interface ImageAccordionProps {
  /** Panels to show. Defaults to BIM Club highlights. */
  items?: AccordionItem[];
  /** Index of the panel that is open first. Default: 0. */
  defaultIndex?: number;
  /** Accessible name for the group. */
  label?: string;
  /** Extra class for the root element (e.g. for margins from the host page). */
  className?: string;
}

export const DEFAULT_ITEMS: AccordionItem[] = [
  {
    id: "technology",
    title: "Technology",
    image: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=640&q=85",
    alt: "Creative design work in progress",
  },
  {
    id: "innovation",
    title: "Innovation",
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=640&q=85",
    alt: "Students learning together",
  },
  {
    id: "workshops",
    title: "Workshops",
    image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=640&q=85",
    alt: "People collaborating at a technology event",
  },
  {
    id: "events",
    title: "Events",
    image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=640&q=85",
    alt: "Students sharing ideas around a table",
  },
  {
    id: "community",
    title: "Community",
    image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=640&q=85",
    alt: "Students sharing ideas around a table",
  },
];

export default function ImageAccordion({
  items = DEFAULT_ITEMS,
  defaultIndex = 0,
  label = "Highlights",
  className,
}: ImageAccordionProps) {
  const [active, setActive] = useState(() =>
    Math.min(Math.max(defaultIndex, 0), Math.max(items.length - 1, 0)),
  );

  if (items.length === 0) return null;

  // If the image fails to load, hide it and let the panel's background colour show.
  const hideBrokenImage = (e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.visibility = "hidden";
  };

  return (
    <ul
      className={`bim-accordion${className ? ` ${className}` : ""}`}
      aria-label={label}
    >
      {items.map((item, i) => {
        const isActive = i === active;
        return (
          <li key={item.id} className="bim-accordion__item" data-active={isActive}>
            <button
              type="button"
              className="bim-accordion__button"
              aria-expanded={isActive}
              // Mouse hover only; touch and keyboard use click / focus.
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              <img
                className="bim-accordion__img"
                src={item.image}
                alt={item.alt ?? ""}
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={hideBrokenImage}
              />
              <span className="bim-accordion__caption">{item.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
