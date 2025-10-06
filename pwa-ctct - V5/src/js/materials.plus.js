/*!
 * PTKV3 – materials.plus.js (FINAL)
 * Progressive enhancement cho materials.html
 * - Hero carousel tin nổi bật (touch + dots)
 * - Grid & tools giữ nguyên, không phá vỡ code gốc
 * - Định nghĩa scrollToSection() để fix ReferenceError
 */
(function () {
  "use strict";

  // ---- public API: để HTML có thể gọi onclick="scrollToSection('#id')"
  window.scrollToSection = function (selector) {
    try {
      var el = document.querySelector(selector);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      /* no-op */
    }
  };

  // nhỏ gọn: qs / qsa
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); };

  // khởi chạy khi DOM sẵn sàng
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    // 1) Lập hero carousel từ #newsGrid nếu có
    enhanceNewsCarousel();

    // 2) Thêm nút Back-to-top nhỏ gọn
    addBackToTop();
  }

  // ---------------- Hero News Carousel ----------------
  function enhanceNewsCarousel() {
    var newsGrid = $("#newsGrid");
    var newsBlock = $("#newsBlock");
    if (!newsGrid || !newsBlock) return;

    // Lấy dữ liệu tin (tối đa 12) từ newsGrid hiện có
    var cards = $$(".news__card", newsGrid).slice(0, 12);
    if (!cards.length) return;

    // Tạo hero container
    var hero = document.createElement("div");
    hero.className = "mp-hero";
    var track = document.createElement("div");
    track.className = "mp-track";
    hero.appendChild(track);

    // Clone từng card trở thành slide
    cards.forEach(function (card) {
      var slide = document.createElement("article");
      slide.className = "mp-slide";

      // thumb
      var a = $("a", card);
      var img = $(".news__thumb", card);
      var info = $(".news__info", card);
      if (a && img) {
        var a2 = document.createElement("a");
        a2.href = a.getAttribute("href") || "#";
        a2.target = "_blank";
        a2.rel = "noopener";
        var img2 = img.cloneNode(true);
        a2.appendChild(img2);
        slide.appendChild(a2);
      } else {
        var ph = document.createElement("div");
        ph.style.width = "112px";
        ph.style.height = "86px";
        ph.style.background = "#f3f4f6";
        slide.appendChild(ph);
      }

      // info
      var infoWrap = document.createElement("div");
      infoWrap.className = "news__info";
      if (info) {
        // tiêu đề
        var titleLink = $(".news__titlelink", info);
        var tA = document.createElement("a");
        tA.className = "news__titlelink";
        tA.target = "_blank";
        tA.rel = "noopener";
        tA.href = titleLink ? titleLink.getAttribute("href") : (a ? a.getAttribute("href") : "#");
        tA.textContent = titleLink ? titleLink.textContent : (a ? a.textContent.trim() : "Tin nổi bật");
        infoWrap.appendChild(tA);

        // meta
        var meta = $(".news__meta", info);
        var metaOut = document.createElement("div");
        metaOut.className = "news__meta";
        metaOut.textContent = meta ? meta.textContent : "";
        infoWrap.appendChild(metaOut);
      }
      slide.appendChild(infoWrap);

      track.appendChild(slide);
    });

    // chèn hero phía trên newsGrid
    newsBlock.appendChild(hero);
    // ẩn grid cũ cho gọn (vẫn giữ trong DOM để JS gốc khác không lỗi)
    newsGrid.classList.add("mp-as-hero");

    // dots
    var dotsWrap = document.createElement("div");
    dotsWrap.className = "mp-dots";
    var slidesCount = $$(".mp-slide", hero).length;
    var dots = [];
    for (var i = 0; i < slidesCount; i++) {
      var dot = document.createElement("button");
      dot.className = "mp-dot";
      dot.type = "button";
      dot.setAttribute("aria-label", "Slide " + (i + 1));
      if (i === 0) dot.setAttribute("aria-current", "true");
      (function (idx) {
        dot.addEventListener("click", function () {
          scrollToIdx(idx);
        });
      })(i);
      dotsWrap.appendChild(dot);
      dots.push(dot);
    }
    hero.appendChild(dotsWrap);

    // logic sync dots
    var ticking = false;
    track.addEventListener("scroll", function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          syncDots();
          ticking = false;
        });
        ticking = true;
      }
    });

    function syncDots() {
      var scrollLeft = track.scrollLeft;
      var w = track.clientWidth;
      var colW = track.firstElementChild ? track.firstElementChild.clientWidth + 14 /*gap*/ : w;
      // ước lượng index gần nhất
      var idx = Math.round(scrollLeft / colW);
      dots.forEach(function (d, i) {
        if (i === idx) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    }

    function scrollToIdx(i) {
      var el = $$(".mp-slide", track)[i];
      if (el) el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }

  // ---------------- Back To Top ----------------
  function addBackToTop() {
    var btn = document.createElement("button");
    btn.className = "mp-backtop";
    btn.setAttribute("aria-label", "Lên đầu trang");
    btn.innerHTML = "↑";
    document.body.appendChild(btn);

    var onScroll = function () {
      if (window.scrollY > 400) btn.classList.add("show");
      else btn.classList.remove("show");
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();
