import assert from "node:assert/strict";
import {message} from "../src/i18n/messages.ts";

export async function checkTaskQueue(page, locale) {
  const t = key => message(locale, key);
  const owner = page.getByRole("combobox", {name: t("queueOwner")});
  const proposal = page.getByText("Send revised proposal", {exact: true});
  await owner.selectOption("mine");
  await proposal.waitFor();
  assert.equal(await page.getByText("Follow up with Northstar", {exact: true}).count(), 0);
  await page.getByRole("heading", {name: new RegExp(t("queueOverdue"))}).waitFor();
  await owner.selectOption("unassigned");
  await page.getByText(t("noTasksInThisView"), {exact: true}).waitFor();
  assert.equal(await proposal.count(), 0);
  await owner.selectOption("everyone");
  await page.getByRole("button", {name: t("open"), exact: true}).click();
  await page.getByRole("heading", {name: new RegExp(t("queueUpcoming"))}).waitFor();
  await page.getByText("Follow up with Northstar", {exact: true}).waitFor();
}

export async function checkNavigationFocus(page, locale) {
  const t = key => message(locale, key);
  const trigger = page.getByRole("button", {name: t("toggleNavigation"), exact: true});
  const drawer = page.getByRole("dialog", {name: t("workspaceNavigation")});
  await trigger.click();
  await drawer.waitFor();
  await page.keyboard.press("Shift+Tab");
  assert.ok(await drawer.evaluate(el => el.contains(document.activeElement)));
  await page.keyboard.press("Escape");
  await drawer.waitFor({state: "hidden"});
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-expanded") === "false");
  assert.ok(await trigger.evaluate(el => el === document.activeElement));
}
