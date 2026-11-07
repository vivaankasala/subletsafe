import { test, expect } from "@playwright/test";
test("home has working entry points and no horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your place. Find your people." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Find a space", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your campus community starts here." }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("No live accounts");
});
test("sign-in cannot pretend to work without Supabase", async ({ page }) => {
  await page.goto("/auth");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find your people.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create your account", exact: true }),
  ).toBeDisabled();
});
test("safety guidance is accessible without an account", async ({ page }) => {
  await page.goto("/safety");
  await expect(
    page.getByRole("heading", { name: "Know what confirmation means." }),
  ).toBeVisible();
  await expect(
    page.getByText("University email confirmation checks access", {
      exact: false,
    }),
  ).toBeVisible();
});
