import { Component } from '@theme/component';
import { debounce } from '@theme/utilities';

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
  #slideHeight = null;
  #thumbnailClickHandlers = new Map();

  connectedCallback() {
    super.connectedCallback();
    
    
    // Initialize slides and thumbnails
    this.#initializeSlides();
    this.#initializeThumbnails();
    
    // Add scroll event listener
    this.refs.mediaContainer.addEventListener('scroll', this.handleScroll);
    
    // Add thumbnail click handlers
    this.#addThumbnailHandlers();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    this.refs.mediaContainer.removeEventListener('scroll', this.handleScroll);
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
    
    // Cache slide height for performance
    if (this.refs.slides.length > 0) {
      this.#slideHeight = this.refs.slides[0].offsetHeight;
    }
    
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
      const clickHandler = () => this.selectSlide(index);
      const pointerHandler = () => this.#loadSlideContent(index);
      
      // Store handlers for proper removal
      this.#thumbnailClickHandlers.set(button, { clickHandler, pointerHandler });
      
      button.addEventListener('click', clickHandler);
      button.addEventListener('pointerenter', pointerHandler);
    });
  }

  /**
   * Remove event handlers from thumbnail buttons
   */
  #removeThumbnailHandlers() {
    if (!this.refs.thumbnailButtons) return;
    
    this.refs.thumbnailButtons.forEach((button) => {
      const handlers = this.#thumbnailClickHandlers.get(button);
      if (handlers) {
        button.removeEventListener('click', handlers.clickHandler);
        button.removeEventListener('pointerenter', handlers.pointerHandler);
        this.#thumbnailClickHandlers.delete(button);
      }
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
  }, 16);


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
    
    // Scroll to the target slide within the container
    const scrollTop = index * (this.#slideHeight || targetSlide.offsetHeight);
    
    if (options.behavior === 'instant') {
      mediaContainer.scrollTop = scrollTop;
    } else {
      mediaContainer.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
    
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
   * Get the total number of slides
   * @returns {number} The total number of slides
   */
  get slideCount() {
    return this.refs.slides?.length || 0;
  }
}

if (!customElements.get('vertical-slideshow-component')) {
  customElements.define('vertical-slideshow-component', VerticalSlideshow);
}
