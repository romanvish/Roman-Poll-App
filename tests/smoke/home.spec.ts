import { test, expect } from "@playwright/test";

test("public home presents the latest published archive edition", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Roman Poll | College Football Top 25");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The game is betterwith a little debate.");
  await expect(page.getByRole("heading", { name: /2026: Week 7/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /BYU/ }).first()).toHaveAttribute("href", "/teams/byu");
  await expect(page.getByText("sam@demo.invalid")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  if (testInfo.project.name !== "desktop") {
    const menu = page.locator("summary");
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(page.locator("details.mobile-menu")).not.toHaveAttribute("open");
  } else {
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    for (const label of ["Ballots", "Compare", "About"]) {
      await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: label })).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("sign-in is available and admin pages redirect guests", async ({ page }) => {
  const protectedResponse = await page.goto("/admin/users");
  expect(protectedResponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fusers$/);
  await expect(page.getByRole("heading", { name: "Welcome to the Roman Poll." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("public rankings endpoint exposes only a published edition", async ({ request }) => {
  const published = await request.get("/api/rankings/2026/1");
  expect(published.status()).toBe(200);
  const unpublished = await request.get("/api/rankings/2026/8");
  expect(unpublished.status()).toBe(404);
  const latest = await request.get("/api/rankings/latest");
  expect([200, 404]).toContain(latest.status());
  expect(latest.headers()["access-control-allow-origin"]).toBe("https://static.example.test");
  if (latest.status() === 200) {
    const payload = await latest.json();
    expect(Object.keys(payload)).toEqual(["season", "week", "label", "publishedAt", "voters", "rankings", "othersReceivingVotes", "ballots"]);
  }
});

test("ballot, compare, and about pages include legacy archive data", async ({ page }) => {
  await page.goto("/ballots/2026/week/7");
  await expect(page.getByRole("heading", { name: "Every vote, out in the open." })).toBeVisible();

  await page.goto("/compare/2026/week/7?left=roman-vish&right=tanner-meeves");
  await expect(page.getByLabel("First voter")).toHaveValue("roman-vish");
  await expect(page.getByLabel("Second voter")).toHaveValue("tanner-meeves");
  await page.getByLabel("First voter").selectOption("carter-reeves");
  await expect(page).toHaveURL(/left=carter-reeves/);

  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "A poll you can inspect, not just accept." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meet the voters" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Meet Roman/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("unpublished editions and unknown voter profiles show the not-found page", async ({ page }) => {
  for (const path of ["/ballots/2026/week/8", "/compare/2026/week/8", "/voters/not-a-voter"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "This page isn’t available." })).toBeVisible();
    await expect(page.getByText("sam@demo.invalid")).toHaveCount(0);
  }
  await page.goto("/voters/demo-voter-1");
  await expect(page.getByRole("heading", { name: "Sam", exact: true })).toBeVisible();
  await expect(page.getByText("No published ballot yet")).toBeVisible();
});

test("legacy voter and team pages expose their historical details", async ({ page }) => {
  await page.goto("/voters/roman-vish");
  await expect(page.getByRole("heading", { name: /signature takes/i })).toBeVisible();
  await expect(page.locator(".public-voter-hero .public-voter-avatar img")).toBeVisible();
  await page.goto("/teams/alabama");
  await expect(page.getByRole("heading", { name: "Alabama poll history" })).toBeVisible();
  await expect(page.locator("svg[role='img']")).toBeVisible();
});
