import { Component } from '@theme/component';
import {
  debounce,
  prefersReducedMotion,
} from '@theme/utilities';
import { scrollIntoView } from '@theme/scrolling';

/**
 * A custom element that renders a vertical slideshow.
 * Similar to zoom-dialog functionality but for regular slideshow content.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} mediaContainer - The media container element.
 * @property {HTMLElement} thumbnails - The thumbnails container element.
 * @property {HTMLElement[]} slides - The slide elements.
 * @property {HTMLElement[]} thumbnailButtons - The thumbnail button elements.
 *
 * @extends Component<Refs>
 */
export class VerticalSlideshow extends Component {
  requiredRefs = ['mediaContainer', 'thumbnails'];

  #isScrolling = false;
  #scrollTimeout = null;

  connectedCallback() {
    super.connectedCallback();
    
    // Initialize slides and thumbnails
    this.#initializeSlides();
    this.#initializeThumbnails();
    
    // Add scroll event listener
    this.refs.mediaContainer.addEventListener('scroll', this.handleScroll);
    
    // Add mouse wheel event listener for snapping
    this.refs.mediaContainer.addEventListener('wheel', this.handleWheel, { passive: false });
    
    // Add thumbnail click handlers
    this.#addThumbnailHandlers();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    this.refs.mediaContainer.removeEventListener('scroll', this.handleScroll);
    this.refs.mediaContainer.removeEventListener('wheel', this.handleWheel);
    this.#removeThumbnailHandlers();
    
    if (this.#scrollTimeout) {
      clearTimeout(this.#scrollTimeout);
    }
  }

  /**
   * Initialize slides array and set up initial state
   */
  #initializeSlides() {
    this.refs.slides = Array.from(this.refs.mediaContainer.children);
    
    // Set up initial visibility
    this.refs.slides.forEach((slide, index) => {
      slide.setAttribute('data-slide-index', index);
      if (index === 0) {
        slide.setAttribute('aria-hidden', 'false');
      } else {
        slide.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /**
   * Initialize thumbnails with content from slides
   */
  #initializeThumbnails() {
    if (!this.refs.thumbnails || !this.refs.slides) return;
    
    this.refs.thumbnailButtons = Array.from(this.refs.thumbnails.querySelectorAll('.vertical-slideshow__thumbnail'));
    
    // Populate thumbnail content
    this.refs.thumbnailButtons.forEach((button, index) => {
      const slide = this.refs.slides[index];
      if (!slide) return;
      
      // Try to get thumbnail content from slide
      const thumbnailImage = slide.querySelector('img');
      const thumbnailContent = slide.querySelector('[data-thumbnail]');
      
      if (thumbnailContent) {
        button.innerHTML = thumbnailContent.innerHTML;
      } else if (thumbnailImage) {
        // Create a thumbnail version of the main image
        const thumbnailImg = document.createElement('img');
        thumbnailImg.src = thumbnailImage.src;
        thumbnailImg.alt = thumbnailImage.alt || `Slide ${index + 1}`;
        thumbnailImg.className = 'vertical-slideshow__thumbnail-image';
        button.innerHTML = '';
        button.appendChild(thumbnailImg);
      } else {
        // Fallback: use slide index
        button.textContent = index + 1;
      }
    });
  }

  /**
   * Add event handlers to thumbnail buttons
   */
  #addThumbnailHandlers() {
    if (!this.refs.thumbnailButtons) return;
    
    this.refs.thumbnailButtons.forEach((button, index) => {
      button.addEventListener('click', () => this.selectSlide(index));
      button.addEventListener('pointerenter', () => this.#loadSlideContent(index));
    });
  }

  /**
   * Remove event handlers from thumbnail buttons
   */
  #removeThumbnailHandlers() {
    if (!this.refs.thumbnailButtons) return;
    
    this.refs.thumbnailButtons.forEach((button, index) => {
      button.removeEventListener('click', () => this.selectSlide(index));
      button.removeEventListener('pointerenter', () => this.#loadSlideContent(index));
    });
  }

  /**
   * Handle scroll event to update active thumbnail
   */
  handleScroll = debounce(async () => {
    if (this.#isScrolling) return;
    
    const { slides, thumbnails } = this.refs;
    
    if (!slides || !slides.length) return;
    
    const mostVisibleElement = await this.#getMostVisibleElement(slides);
    const activeIndex = slides.indexOf(mostVisibleElement);
    
    this.#updateActiveThumbnail(activeIndex);
    this.#updateSlideVisibility(activeIndex);
  }, 50);

  /**
   * Handle wheel event for snapping behavior
   */
  handleWheel = (event) => {
    if (prefersReducedMotion()) return;
    
    event.preventDefault();
    
    if (this.#isScrolling) return;
    
    const { slides } = this.refs;
    if (!slides || slides.length <= 1) return;
    
    const currentIndex = this.#getCurrentSlideIndex();
    const direction = event.deltaY > 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(slides.length - 1, currentIndex + direction));
    
    if (nextIndex !== currentIndex) {
      this.selectSlide(nextIndex, { behavior: 'smooth' });
    }
  };

  /**
   * Select a specific slide
   * @param {number} index - The index of the slide to select
   * @param {Object} options - Options for selection
   * @param {ScrollBehavior} options.behavior - Scroll behavior
   */
  async selectSlide(index, options = { behavior: 'smooth' }) {
    const { slides, mediaContainer } = this.refs;
    
    if (!slides || index < 0 || index >= slides.length) return;
    
    const targetSlide = slides[index];
    if (!targetSlide) return;
    
    this.#isScrolling = true;
    
    // Update thumbnail selection immediately for better UX
    this.#updateActiveThumbnail(index);
    this.#updateSlideVisibility(index);
    
    // Scroll to the target slide
    targetSlide.scrollIntoView({
      behavior: options.behavior,
      block: 'center',
    });
    
    // Clear scrolling flag after animation
    this.#scrollTimeout = setTimeout(() => {
      this.#isScrolling = false;
    }, options.behavior === 'instant' ? 0 : 300);
    
    // Load content for the selected slide
    this.#loadSlideContent(index);
  }

  /**
   * Update the active thumbnail
   * @param {number} activeIndex - The index of the active slide
   */
  #updateActiveThumbnail(activeIndex) {
    if (!this.refs.thumbnailButtons) return;
    
    this.refs.thumbnailButtons.forEach((button, index) => {
      button.setAttribute('aria-selected', `${index === activeIndex}`);
    });
  }

  /**
   * Update slide visibility based on active slide
   * @param {number} activeIndex - The index of the active slide
   */
  #updateSlideVisibility(activeIndex) {
    if (!this.refs.slides) return;
    
    this.refs.slides.forEach((slide, index) => {
      slide.setAttribute('aria-hidden', `${index !== activeIndex}`);
    });
  }

  /**
   * Get the current slide index based on scroll position
   * @returns {number} The current slide index
   */
  #getCurrentSlideIndex() {
    const { slides } = this.refs;
    if (!slides || !slides.length) return 0;
    
    const containerRect = this.refs.mediaContainer.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;
    
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    slides.forEach((slide, index) => {
      const slideRect = slide.getBoundingClientRect();
      const slideCenter = slideRect.top + slideRect.height / 2;
      const distance = Math.abs(slideCenter - containerCenter);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    return closestIndex;
  }

  /**
   * Load content for a specific slide (for lazy loading, etc.)
   * @param {number} index - The index of the slide to load
   */
  #loadSlideContent(index) {
    const slide = this.refs.slides?.[index];
    if (!slide) return;
    
    // Trigger any lazy loading or content loading for this slide
    const lazyElements = slide.querySelectorAll('[data-src], [loading="lazy"]');
    lazyElements.forEach(element => {
      if (element.dataset.src) {
        element.src = element.dataset.src;
        element.removeAttribute('data-src');
      }
    });
    
    // Dispatch event for external listeners
    this.dispatchEvent(new CustomEvent('slide-content-loaded', {
      detail: { index, slide }
    }));
  }

  /**
   * Get the most visible element from a list of elements
   * @param {HTMLElement[]} elements - The elements to check
   * @returns {Promise<HTMLElement>} The most visible element
   */
  #getMostVisibleElement(elements) {
    return new Promise((resolve) => {
      const observer = new IntersectionObserver(
        (entries) => {
          const mostVisible = entries.reduce((prev, current) =>
            current.intersectionRatio > prev.intersectionRatio ? current : prev
          );
          observer.disconnect();
          resolve(/** @type {HTMLElement} */ (mostVisible.target));
        },
        {
          threshold: Array.from({ length: 100 }, (_, i) => i / 100),
        }
      );

      for (const element of elements) {
        observer.observe(element);
      }
    });
  }

  /**
   * Get the current slide index
   * @returns {number} The current slide index
   */
  get currentIndex() {
    return this.#getCurrentSlideIndex();
  }

  /**
   * Get the total number of slides
   * @returns {number} The total number of slides
   */
  get slideCount() {
    return this.refs.slides?.length || 0;
  }

  /**
   * Navigate to the next slide
   */
  next() {
    const currentIndex = this.currentIndex;
    if (currentIndex < this.slideCount - 1) {
      this.selectSlide(currentIndex + 1);
    }
  }

  /**
   * Navigate to the previous slide
   */
  previous() {
    const currentIndex = this.currentIndex;
    if (currentIndex > 0) {
      this.selectSlide(currentIndex - 1);
    }
  }
}

if (!customElements.get('vertical-slideshow-component')) {
  customElements.define('vertical-slideshow-component', VerticalSlideshow);
}
