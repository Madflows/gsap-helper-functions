/**
 * Creates a horizontal looping animation for a set of elements along the x-axis.
 * This function configures a GSAP timeline for the animation which loops seamlessly
 * and is responsive to size changes like window resizing.
 *
 * @param {Array|NodeList|string} items - The elements to be animated. Can be a selector string, an array, or a NodeList.
 * @param {Object} [config={}] - Configuration object with optional properties:
 *  - speed {number} [1] - Speed at which elements travel, approximately 100 pixels per second by default.
 *  - paused {boolean} [false] - Whether the timeline starts in a paused state.
 *  - repeat {number} [0] - Number of times the timeline should repeat.
 *  - reversed {boolean} [false] - Whether the timeline should start in reversed state.
 *  - paddingRight {number} [0] - Right padding to add to the total width calculation.
 *
 * @returns {GSAPTimeline} - The GSAP timeline instance for controlling the animation.
 *
 * Features added to the timeline:
 *  - next() - Advances the animation to the next element.
 *  - previous() - Rewinds the animation to the previous element.
 *  - toIndex(index, vars) - Jumps the animation to the specified index.
 *  - current() - Returns the current index of the animation.
 *  - times - Array of times each element hits the "starting" spot.
 */
function horizontalLoop(items, config) {
  items = gsap.utils.toArray(items);
  config = config || {};
  let tl = gsap.timeline({
      repeat: config.repeat,
      paused: config.paused,
      defaults: { ease: 'none' },
      onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100),
    }),
    length = items.length,
    startX = items[0].offsetLeft,
    times = [],
    widths = [],
    xPercents = [],
    curIndex = 0,
    pixelsPerSecond = (config.speed || 1) * 100,
    snap = config.snap === false ? (v) => v : gsap.utils.snap(config.snap || 1), // some browsers shift by a pixel to accommodate flex layouts, so for example if width is 20% the first element's width might be 242px, and the next 243px, alternating back and forth. So we snap to 5 percentage points to make things look more natural
    totalWidth,
    curX,
    distanceToStart,
    distanceToLoop,
    item,
    i;
  gsap.set(items, {
    // convert "x" to "xPercent" to make things responsive, and populate the widths/xPercents Arrays to make lookups faster.
    xPercent: (i, el) => {
      let w = (widths[i] = parseFloat(gsap.getProperty(el, 'width', 'px')));
      xPercents[i] = snap(
        (parseFloat(gsap.getProperty(el, 'x', 'px')) / w) * 100 +
          gsap.getProperty(el, 'xPercent')
      );
      return xPercents[i];
    },
  });
  gsap.set(items, { x: 0 });
  totalWidth =
    items[length - 1].offsetLeft +
    (xPercents[length - 1] / 100) * widths[length - 1] -
    startX +
    items[length - 1].offsetWidth *
      gsap.getProperty(items[length - 1], 'scaleX') +
    (parseFloat(config.paddingRight) || 0);
  for (i = 0; i < length; i++) {
    item = items[i];
    curX = (xPercents[i] / 100) * widths[i];
    distanceToStart = item.offsetLeft + curX - startX;
    distanceToLoop =
      distanceToStart + widths[i] * gsap.getProperty(item, 'scaleX');
    tl.to(
      item,
      {
        xPercent: snap(((curX - distanceToLoop) / widths[i]) * 100),
        duration: distanceToLoop / pixelsPerSecond,
      },
      0
    )
      .fromTo(
        item,
        {
          xPercent: snap(
            ((curX - distanceToLoop + totalWidth) / widths[i]) * 100
          ),
        },
        {
          xPercent: xPercents[i],
          duration:
            (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond,
          immediateRender: false,
        },
        distanceToLoop / pixelsPerSecond
      )
      .add('label' + i, distanceToStart / pixelsPerSecond);
    times[i] = distanceToStart / pixelsPerSecond;
  }
  function toIndex(index, vars) {
    vars = vars || {};
    Math.abs(index - curIndex) > length / 2 &&
      (index += index > curIndex ? -length : length); // always go in the shortest direction
    let newIndex = gsap.utils.wrap(0, length, index),
      time = times[newIndex];
    if (time > tl.time() !== index > curIndex) {
      // if we're wrapping the timeline's playhead, make the proper adjustments
      vars.modifiers = { time: gsap.utils.wrap(0, tl.duration()) };
      time += tl.duration() * (index > curIndex ? 1 : -1);
    }
    curIndex = newIndex;
    vars.overwrite = true;
    return tl.tweenTo(time, vars);
  }
  tl.next = (vars) => toIndex(curIndex + 1, vars);
  tl.previous = (vars) => toIndex(curIndex - 1, vars);
  tl.current = () => curIndex;
  tl.toIndex = (index, vars) => toIndex(index, vars);
  tl.times = times;
  tl.progress(1, true).progress(0, true); // pre-render for performance
  if (config.reversed) {
    tl.vars.onReverseComplete();
    tl.reverse();
  }
  return tl;
}

/**
 * Creates a flip animation using GSAP's FLIP plugin, where elements smoothly transition
 * from their initial to final state with minimal effort.
 *
 * @param {Array|NodeList|string} elements - The elements to animate. Can be a selector string, an array, or a NodeList.
 * @param {Function} changeFunc - Function that performs the DOM changes to which the animation adapts.
 * @param {Object} [vars={}] - Additional variables for customizing the animation. Possible properties include:
 *  - duration {number} - Duration of each animation in seconds.
 *  - stagger {number|Object|Function} - Stagger start times of animations.
 *  - ease {Ease} - Easing function to control animation pacing.
 *  - onComplete {Function} - Callback function when all animations complete.
 *  - delay {number} - Delay before the animation starts in seconds.
 *
 * @returns {GSAPTimeline} - The GSAP timeline that controls the sequence of animations.
 */
function simpleFlip(elements, changeFunc, vars) {
  elements = gsap.utils.toArray(elements);
  vars = vars || {};
  let tl = gsap.timeline({
      onComplete: vars.onComplete,
      delay: vars.delay || 0,
    }),
    bounds = elements.map((el) => el.getBoundingClientRect()),
    copy = {},
    p;
  elements.forEach((el) => {
    el._flip && el._flip.progress(1);
    el._flip = tl;
  });
  changeFunc();
  for (p in vars) {
    p !== 'onComplete' && p !== 'delay' && (copy[p] = vars[p]);
  }
  copy.x = (i, element) =>
    '+=' + (bounds[i].left - element.getBoundingClientRect().left);
  copy.y = (i, element) =>
    '+=' + (bounds[i].top - element.getBoundingClientRect().top);
  return tl.from(elements, copy);
}

module.exports = { horizontalLoop, simpleFlip };
