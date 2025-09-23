/**
 * Ad Client - Minimal frontend ad integration
 * Handles ad requests, rendering, and click tracking
 */
(function() {
  'use strict';

  // Configuration
  const AD_API_BASE = 'https://venue-backend-1.onrender.com';
  const ANON_ID_COOKIE = 'venue_anon_id';
  const COOKIE_EXPIRY_DAYS = 30;
  const DEBUG_PARAM = 'addebug';

  // State
  let debugMode = false;
  let debugOverlay = null;
  let isLoadingAds = false; // Prevent multiple simultaneous requests
  let telemetry = {
    totalEligible: 0,
    explored: 0,
    exploited: 0,
    capped: 0
  };

  /**
   * Utility Functions
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  }

  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  function getOrCreateAnonId() {
    let anonId = getCookie(ANON_ID_COOKIE);
    if (!anonId) {
      anonId = generateUUID();
      setCookie(ANON_ID_COOKIE, anonId, COOKIE_EXPIRY_DAYS);
    }
    return anonId;
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function extractKeywords(text) {
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'be', 'this', 'that', 'from', 'near'
    ]);

    return text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter(word => word.length > 2 && !stopwords.has(word))
      ?.filter((word, index, arr) => arr.indexOf(word) === index) // dedupe
      ?.slice(0, 5) || [];
  }

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function respects_dnt() {
    return navigator.doNotTrack === "1" ||
           navigator.doNotTrack === "yes" ||
           navigator.msDoNotTrack === "1";
  }

  /**
   * Context Collection
   */
  function collectPageContext() {
    const h1Element = document.querySelector('h1');
    const metaDesc = document.querySelector('meta[name="description"]');

    const title = document.title || '';
    const h1 = h1Element ? h1Element.textContent.trim() : '';
    const meta_description = metaDesc ? metaDesc.getAttribute('content') || '' : '';

    return {
      url: location.href,
      path: location.pathname,
      title: title,
      h1: h1,
      meta_description: meta_description
    };
  }

  function collectUserContext() {
    return {
      lang: navigator.language || 'en-US',
      device: isMobile() ? 'mobile' : 'desktop'
    };
  }

  /**
   * Debug Functionality
   */
  function createDebugOverlay() {
    if (debugOverlay) return;

    debugOverlay = document.createElement('div');
    debugOverlay.id = 'ad-debug-overlay';
    debugOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 5px;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      float: right;
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 16px;
      margin-left: 10px;
    `;
    closeBtn.onclick = () => {
      debugOverlay.remove();
      debugOverlay = null;
    };

    debugOverlay.appendChild(closeBtn);
    document.body.appendChild(debugOverlay);
  }

  function updateDebugInfo(info) {
    if (!debugMode || !debugOverlay) return;

    const content = `
      <h4>Ad Debug Info</h4>
      <p><strong>Topic:</strong> ${info.topic || 'N/A'}</p>
      <p><strong>Keywords:</strong> ${(info.keywords || []).join(', ')}</p>
      <p><strong>Ad Count:</strong> ${info.ad_count || 0}</p>
      <p><strong>Ad IDs:</strong> ${info.ad_ids || 'N/A'}</p>
      <h5>Telemetry</h5>
      <p>Total: ${telemetry.totalEligible}</p>
      <p>Explored: ${telemetry.explored}</p>
      <p>Exploited: ${telemetry.exploited}</p>
      <p>Capped: ${telemetry.capped}</p>
    `;

    debugOverlay.innerHTML = content;
    // Re-add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      float: right;
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 16px;
      margin-left: 10px;
    `;
    closeBtn.onclick = () => {
      debugOverlay.remove();
      debugOverlay = null;
    };
    debugOverlay.insertBefore(closeBtn, debugOverlay.firstChild);
  }

  /**
   * Ad Request and Rendering
   */
  async function requestMultipleAds() {
    if (respects_dnt()) {
      console.log('[AdClient] DNT enabled, skipping ad request');
      return null;
    }

    const pageContext = collectPageContext();
    const userContext = collectUserContext();
    const anonId = getOrCreateAnonId();

    const payload = {
      page_context: pageContext,
      user_context: userContext,
      anon_id: anonId
    };

    try {
      const response = await fetch(`${AD_API_BASE}/api/content/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Update telemetry
      if (data.ads && data.ads.length > 0) {
        telemetry.totalEligible += data.ads.length;
      }

      if (debugMode) {
        const debugInfo = {
          topic: data.context?.topic,
          keywords: extractKeywords([pageContext.title, pageContext.h1, pageContext.meta_description].join(' ')),
          ad_count: data.ads?.length || 0,
          ad_ids: data.ads?.map(ad => ad.ad_id).join(', ') || 'None'
        };
        updateDebugInfo(debugInfo);
      }

      return data;

    } catch (error) {
      console.error('[AdClient] Ad request failed:', error);
      return null;
    }
  }

  function renderAd(ad, container) {
    console.log('[AdClient] renderAd called with:', ad);
    if (!ad) {
      console.log('[AdClient] No ad data available:', ad);
      container.innerHTML = '<div class="ad-placeholder">No ads available</div>';
      return;
    }

    // Store impression_id for click tracking
    container.dataset.impressionId = ad.impression_id;
    container.dataset.adId = ad.ad_id;

    // Render the larger ad
    container.innerHTML = `
      <div class="ad-container" style="
        border: 2px solid #e0e0e0;
        padding: 24px;
        border-radius: 12px;
        background: linear-gradient(135deg, #f8f9fa 0%, #f1f3f5 100%);
        text-align: center;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      ">
        <div class="ad-content">
          <h3 style="margin: 0 0 16px 0; color: #2c3e50; font-size: 20px; font-weight: 600; line-height: 1.3;">${ad.headline}</h3>
          <p style="margin: 0 0 20px 0; color: #495057; font-size: 16px; line-height: 1.5;">${ad.body}</p>
          <div style="margin: 16px 0;">
            ${ad.html.replace('<a ', '<a style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; transition: background 0.2s ease;" onmouseover="this.style.background=\'#0056b3\'" onmouseout="this.style.background=\'#007bff\'" ')}
          </div>
        </div>
        <div class="ad-label" style="
          font-size: 11px;
          color: #6c757d;
          margin-top: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 500;
        ">Advertisement</div>
      </div>
    `;
  }

  /**
   * Click Tracking
   */
  async function trackClick(impressionId) {
    try {
      const payload = { impression_id: impressionId };

      // Use sendBeacon if available, fallback to fetch with keepalive
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${AD_API_BASE}/api/content/click`, JSON.stringify(payload));
      } else {
        fetch(`${AD_API_BASE}/api/content/click`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {}); // Ignore errors for tracking
      }

      console.log('[AdClient] Click tracked:', impressionId);
    } catch (error) {
      console.error('[AdClient] Click tracking failed:', error);
    }
  }

  /**
   * Event Delegation for Click Handling
   */
  function setupClickTracking() {
    document.addEventListener('click', function(event) {
      // Find the closest ad container
      const adContainer = event.target.closest('[data-ad-slot]');
      if (!adContainer) return;

      // Check if the click was on an ad link
      const adLink = event.target.closest('a[rel*="sponsored"]');
      if (!adLink) return;

      const impressionId = adContainer.dataset.impressionId;
      if (impressionId) {
        trackClick(impressionId);
      }

      // Allow the navigation to proceed
    }, true); // Use capture to ensure we get the event
  }

  /**
   * Main Initialization
   */
  async function loadAdsForContainers() {
    // Prevent multiple simultaneous requests
    if (isLoadingAds) {
      console.log('[AdClient] Already loading ads, skipping duplicate request');
      return;
    }

    const containers = document.querySelectorAll('[data-ad-slot]');
    console.log('[AdClient] Found', containers.length, 'ad containers');

    if (containers.length === 0) {
      console.log('[AdClient] No ad containers found, skipping ad load');
      return;
    }

    isLoadingAds = true;

    // Clear existing ads and set minimum height to prevent layout shift
    containers.forEach(container => {
      container.innerHTML = ''; // Clear existing content
      if (!container.style.minHeight) {
        container.style.minHeight = '140px';
      }
    });

    try {
      // Single API call for all ads
      console.log('[AdClient] Making single API call for multiple ads');
      const adsData = await requestMultipleAds();
      console.log('[AdClient] Received ads data:', adsData);

      if (!adsData || !adsData.ads || adsData.ads.length === 0) {
        console.log('[AdClient] No ads received');
        containers.forEach(container => {
          container.innerHTML = '<div class="ad-placeholder">No ads available</div>';
        });
        return;
      }

      // Use only the first ad for all containers (now we only have one container)
      const ads = adsData.ads;
      const primaryAd = ads[0]; // Use the first/best ad

      containers.forEach((container) => {
        if (primaryAd) {
          console.log('[AdClient] Rendering primary ad to container:', container.dataset.adSlot);
          renderAd(primaryAd, container);
        } else {
          console.log('[AdClient] No ad available for container:', container.dataset.adSlot);
          container.innerHTML = '<div class="ad-placeholder">No ad available</div>';
        }
      });

      console.log('[AdClient] Rendered ad successfully');

    } catch (error) {
      console.error('[AdClient] Failed to load ads:', error);
      containers.forEach(container => {
        container.innerHTML = '<div class="ad-placeholder">Failed to load ads</div>';
      });
    } finally {
      isLoadingAds = false;
    }
  }

  /**
   * Initialization
   */
  function init() {
    // Check if debug mode is enabled
    const urlParams = new URLSearchParams(window.location.search);
    debugMode = urlParams.get(DEBUG_PARAM) === '1';

    if (debugMode) {
      createDebugOverlay();
      console.log('[AdClient] Debug mode enabled');
    }

    // Set up click tracking
    setupClickTracking();

    // Load ads when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadAdsForContainers);
    } else {
      loadAdsForContainers();
    }

    console.log('[AdClient] Initialized');
  }

  // Auto-initialize
  init();

  // Expose API for manual control if needed
  window.AdClient = {
    loadAds: loadAdsForContainers,
    forceReload: () => {
      console.log('[AdClient] Force reloading ads... Current loading state:', isLoadingAds);
      isLoadingAds = false; // Reset loading state

      // Clear any existing ads immediately
      const containers = document.querySelectorAll('[data-ad-slot]');
      containers.forEach(container => {
        container.innerHTML = '<div style=\"text-align: center; color: #9CA3AF; font-size: 14px; padding: 20px;\">Loading fresh ads...</div>';
      });

      // Force reload with small delay
      setTimeout(() => {
        loadAdsForContainers();
      }, 100);
    },
    trackClick: trackClick,
    getTelemetry: () => ({ ...telemetry }),
    getStatus: () => ({
      isLoading: isLoadingAds,
      containersFound: document.querySelectorAll('[data-ad-slot]').length,
      scriptLoaded: true
    }),
    toggleDebug: () => {
      debugMode = !debugMode;
      if (debugMode) {
        createDebugOverlay();
      } else if (debugOverlay) {
        debugOverlay.remove();
        debugOverlay = null;
      }
    }
  };

})();