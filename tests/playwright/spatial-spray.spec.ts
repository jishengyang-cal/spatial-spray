import { expect, test } from "@playwright/test";

test("user can sign in, claim username, create spray, and see it nearby", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("login-apple").click();
  await page.getByTestId("username-input").fill(`web_artist_${Date.now().toString().slice(-6)}`);
  await page.getByTestId("claim-username").click();

  await expect(page.getByTestId("active-user")).toContainText("web_artist");

  await page.getByTestId("camera-mode").click();
  const canvas = page.getByTestId("spray-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const startX = box!.x + box!.width * 0.35;
  const startY = box!.y + box!.height * 0.45;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 90, startY + 20, { steps: 8 });
  await page.mouse.move(startX + 140, startY - 35, { steps: 8 });
  await page.mouse.up();

  await page.getByTestId("publish-spray").click();
  await expect(page.getByTestId("status")).toContainText("Spray published nearby");
  await expect(page.getByTestId("nearby-list")).toContainText("Spray by @web_artist");
  await expect(page.getByTestId("map")).toBeVisible();
});

test("user can save a private spray and switch it to public", async ({ page }) => {
  await page.goto("/");

  const username = `private_artist_${Date.now().toString().slice(-6)}`;
  await page.getByTestId("login-google").click();
  await page.getByTestId("username-input").fill(username);
  await page.getByTestId("claim-username").click();
  await expect(page.getByTestId("active-user")).toContainText(username);

  await page.getByTestId("visibility-select").selectOption("private");
  await page.getByTestId("camera-mode").click();
  const canvas = page.getByTestId("spray-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const startX = box!.x + box!.width * 0.4;
  const startY = box!.y + box!.height * 0.5;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 12, { steps: 8 });
  await page.mouse.up();

  await page.getByTestId("publish-spray").click();
  await expect(page.getByTestId("status")).toContainText("Private spray saved for you");
  await expect(page.getByTestId("nearby-list")).toContainText("Only me");
  await expect(page.getByTestId("nearby-list")).toContainText(`Spray by @${username}`);

  const privateCard = page.locator(".spray-card").filter({ hasText: `Spray by @${username}` }).first();
  await privateCard.getByRole("button", { name: "Details" }).click();
  await expect(page.getByTestId("selected-spray")).toContainText("Only me");

  await page.getByTestId("toggle-visibility").click();
  await expect(page.getByTestId("status")).toContainText("Spray is visible to everyone");
  await expect(page.getByTestId("nearby-list")).toContainText("Everyone");
});
