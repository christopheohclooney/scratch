import "./styles.css";
import { calendars, findCalendar, type Group } from "./config/calendars";
import { copy } from "./config/copy";
import { clearCalendar, mountCalendar } from "./calendar";
import { isEmbedded, prefersReducedMotion, reportHeight, scrollToElement } from "./embed";

interface Option {
  value: string;
  label: string;
}

interface State {
  group: Group | null;
  slug: string | null;
}

const state: State = { group: null, slug: null };

/* Pause between an answer and the scroll, so the next step starts to appear first. */
const SCROLL_DELAY = 180;
/* Arrow keys move through radios one by one; wait before loading a calendar for each. */
const CALENDAR_DELAY = 220;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const eyebrow = (text: string) =>
  `<span class="eyebrow"><span class="eyebrow__mark" aria-hidden="true"></span>${escapeHtml(text)}</span>`;

function radioGroup(name: string, eyebrowText: string, question: string, options: Option[], extra = "") {
  return `
    <fieldset class="question" data-name="${name}">
      <legend class="question__legend">
        ${eyebrow(eyebrowText)}
        <span class="question__text">${escapeHtml(question)}</span>
      </legend>
      ${extra}
      <div class="options options--${options.length}">
        ${options
          .map(
            (o) => `
          <label class="option">
            <input class="option__input" type="radio" name="${name}" value="${o.value}" />
            <span class="option__label">${escapeHtml(o.label)}</span>
          </label>`,
          )
          .join("")}
      </div>
    </fieldset>`;
}

const optionsFor = (group: Group): Option[] =>
  calendars.filter((c) => c.group === group).map((c) => ({ value: c.slug, label: c.label }));

const app = document.querySelector<HTMLElement>("#app")!;

app.innerHTML = `
  <div class="flow">
    <header class="intro">
      <h1 class="intro__heading">
        <span class="intro__line">${escapeHtml(copy.heading.line1)}</span>
        <span class="intro__line intro__line--muted">${escapeHtml(copy.heading.line2)}</span>
      </h1>
    </header>

    <section class="step" id="step-1" data-state="active">
      ${radioGroup("group", copy.step1.eyebrow, copy.step1.question, [
        { value: "adult", label: copy.step1.options.adult },
        { value: "child", label: copy.step1.options.child },
      ])}
    </section>

    <section class="step" id="step-2" data-state="disabled"></section>

    <section class="step" id="step-3" data-state="disabled" aria-labelledby="step-3-title">
      <div class="question">
        <h2 class="question__legend" id="step-3-title">
          ${eyebrow(copy.step3.eyebrow)}
          <span class="question__text">${escapeHtml(copy.step3.question)}</span>
        </h2>
        <p class="booking__placeholder">${escapeHtml(copy.step3.placeholder)}</p>
        <div class="booking__summary" hidden>
          <p class="booking__programme"></p>
          <p class="booking__note">${escapeHtml(copy.step3.paymentNote)}</p>
        </div>
        <div class="booking__calendar"></div>
      </div>
    </section>

    <section class="explainer" id="explainer" aria-labelledby="explainer-title" hidden>
      <div class="explainer__inner">
        <h2 class="explainer__heading" id="explainer-title">
          ${eyebrow(copy.explainer.eyebrow)}
          <span class="question__text">${escapeHtml(copy.explainer.heading)}</span>
        </h2>
        <dl class="explainer__list">
          ${calendars
            .filter((c) => c.group === "adult")
            .map(
              (c) => `
            <div class="explainer__item">
              <dt>${escapeHtml(c.label)}</dt>
              <dd>${escapeHtml(copy.explainer.items[c.slug] ?? "")}</dd>
            </div>`,
            )
            .join("")}
        </dl>
        <button type="button" class="text-link explainer__close">${escapeHtml(copy.explainer.close)}</button>
      </div>
    </section>
  </div>
`;

const step1 = app.querySelector<HTMLElement>("#step-1")!;
const step2 = app.querySelector<HTMLElement>("#step-2")!;
const step3 = app.querySelector<HTMLElement>("#step-3")!;
const placeholder = step3.querySelector<HTMLElement>(".booking__placeholder")!;
const summary = step3.querySelector<HTMLElement>(".booking__summary")!;
const programmeLine = step3.querySelector<HTMLElement>(".booking__programme")!;
const calendarSlot = step3.querySelector<HTMLElement>(".booking__calendar")!;
const explainer = app.querySelector<HTMLElement>("#explainer")!;

/* Plays the fade and rise on an element. Restarts cleanly if it's already running. */
function reveal(el: HTMLElement, animate: boolean) {
  if (!animate || prefersReducedMotion()) return;
  el.classList.remove("is-revealing");
  void el.offsetWidth;
  el.classList.add("is-revealing");
  el.addEventListener("animationend", () => el.classList.remove("is-revealing"), { once: true });
}

function setStepState(step: HTMLElement, active: boolean) {
  step.dataset.state = active ? "active" : "disabled";
  const fieldset = step.querySelector("fieldset");
  if (fieldset) fieldset.disabled = !active;
  if (step === step3) step.setAttribute("aria-disabled", String(!active));
}

let scrollTimer = 0;
let calendarTimer = 0;
function scrollToStep(el: HTMLElement) {
  clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(() => scrollToElement(el), prefersReducedMotion() ? 0 : SCROLL_DELAY);
}

function renderStep2(animate: boolean) {
  /* Before step 1 is answered, the adult question sits greyed out as a preview of what's next. */
  const group = state.group ?? "adult";
  const helpLink = `<button type="button" class="text-link help-link" aria-expanded="${!explainer.hidden}" aria-controls="explainer">${escapeHtml(copy.step2Adult.helpLink)}</button>`;
  step2.innerHTML =
    group === "adult"
      ? radioGroup("programme", copy.step2Adult.eyebrow, copy.step2Adult.question, optionsFor("adult"), helpLink)
      : radioGroup("programme", copy.step2Child.eyebrow, copy.step2Child.question, optionsFor("child"));
  step2.dataset.group = group;
  setStepState(step2, state.group !== null);
  reveal(step2, animate);
}

function renderStep3(animate: boolean) {
  const calendar = findCalendar(state.slug);
  clearTimeout(calendarTimer);
  if (!calendar) {
    setStepState(step3, false);
    placeholder.hidden = false;
    summary.hidden = true;
    clearCalendar(calendarSlot);
    return;
  }
  setStepState(step3, true);
  placeholder.hidden = true;
  summary.hidden = false;
  programmeLine.textContent = calendar.label;
  reveal(step3, animate);

  const load = () => mountCalendar(calendarSlot, calendar, () => undefined);
  if (animate) {
    clearCalendar(calendarSlot);
    calendarTimer = window.setTimeout(load, CALENDAR_DELAY);
  } else {
    load();
  }
}
function selectGroup(group: Group, animate: boolean) {
  if (state.group === group) return;
  state.group = group;
  state.slug = null;
  renderStep2(animate);
  renderStep3(false);
  if (animate) scrollToStep(step2);
}

function selectProgramme(slug: string, animate: boolean) {
  if (state.slug === slug) return;
  state.slug = slug;
  renderStep3(animate);
  if (animate) scrollToStep(step3);
}

app.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.name === "group") selectGroup(input.value as Group, true);
  if (input.name === "programme") selectProgramme(input.value, true);
});

function setExplainer(open: boolean) {
  explainer.hidden = !open;
  app.querySelectorAll(".help-link").forEach((b) => b.setAttribute("aria-expanded", String(open)));
  if (open) {
    reveal(explainer, true);
    scrollToStep(explainer);
  }
}

app.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".help-link")) setExplainer(explainer.hidden);
  if (target.closest(".explainer__close")) {
    setExplainer(false);
    app.querySelector<HTMLElement>(".help-link")?.focus();
  }
});

/* Deep link from class pages: ?programme=gi preselects Adult and Gi and loads the Gi calendar. */
function applyDeepLink() {
  const calendar = findCalendar(new URLSearchParams(location.search).get("programme"));
  if (!calendar) return;
  state.group = calendar.group;
  state.slug = calendar.slug;
  step1.querySelector<HTMLInputElement>(`input[value="${calendar.group}"]`)!.checked = true;
  renderStep2(false);
  step2.querySelector<HTMLInputElement>(`input[value="${calendar.slug}"]`)!.checked = true;
  renderStep3(false);
}

renderStep2(false);
renderStep3(false);
applyDeepLink();

if (isEmbedded) document.documentElement.classList.add("is-embedded");
reportHeight();
