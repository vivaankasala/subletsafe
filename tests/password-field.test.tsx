// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, it, expect, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { PasswordField } from "../src/features/auth/PasswordField";
import { AuthProvider } from "../src/features/auth/AuthProvider";
import { getSupabase } from "../src/lib/supabase";
import { AuthPage, UpdatePassword } from "../src/features/auth/AuthPage";
vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://subletsafe-test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_only");
});
const testFetch = vi.fn<typeof fetch>();
afterAll(() => vi.unstubAllEnvs());
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  testFetch.mockReset();
  testFetch.mockImplementation(async () => {
    throw Error("Unexpected network request in test");
  });
  vi.stubGlobal("fetch", testFetch);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("reveals and hides the same typed password without submitting the form", async () => {
  const submit = vi.fn((e: { preventDefault: () => void }) =>
    e.preventDefault(),
  );
  await act(async () =>
    root.render(
      <form onSubmit={submit}>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
        />
      </form>,
    ),
  );
  const input = container.querySelector("input")!;
  input.value = "Synthetic.only 42!";
  expect(input.type).toBe("password");
  const toggle = container.querySelector("button")!;
  expect(toggle.getAttribute("aria-label")).toBe("Show password");
  await act(async () => toggle.click());
  expect(input.type).toBe("text");
  expect(input.value).toBe("Synthetic.only 42!");
  expect(new FormData(container.querySelector("form")!).get("password")).toBe(
    "Synthetic.only 42!",
  );
  expect(toggle.getAttribute("aria-label")).toBe("Hide password");
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  await act(async () => toggle.click());
  expect(input.type).toBe("password");
  expect(input.value).toBe("Synthetic.only 42!");
  expect(submit).not.toHaveBeenCalled();
});
it("opens password recovery from a direct reset link", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/auth?mode=reset"]}>
        <AuthPage />
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain("Reset your password.");
  expect(container.querySelector('input[name="password"]')).toBeNull();
  expect(container.textContent).toContain("Send reset link");
});
it("sign-in offers password recovery alongside a visibility control", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/auth"]}>
        <AuthPage />
      </MemoryRouter>,
    ),
  );
  expect(
    container.querySelector('button[aria-label="Show password"]'),
  ).not.toBeNull();
  const forgot = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Forgot your password"),
  );
  await act(async () => forgot!.click());
  expect(container.textContent).toContain("Reset your password.");
  expect(container.querySelector('input[name="password"]')).toBeNull();
});

it("explains a missing recovery session instead of offering a broken password update", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <UpdatePassword />
        </AuthProvider>
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() =>
    expect(container.textContent).toContain("Open your password-reset link."),
  );
  expect(container.querySelector('input[name="password"]')).toBeNull();
});
it("explains rejected credentials and offers recovery without changing the password", async () => {
  testFetch.mockImplementation(async (input: RequestInfo | URL) => {
    if (!String(input).includes("/auth/v1/token"))
      throw Error("Unexpected network request in test");
    return new Response(
      JSON.stringify({
        code: "invalid_credentials",
        message: "Invalid login credentials",
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json",
          "x-supabase-api-version": "2024-01-01",
        },
      },
    );
  });
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/auth"]}>
        <AuthPage />
      </MemoryRouter>,
    ),
  );
  (container.querySelector('input[name="email"]') as HTMLInputElement).value =
    "synthetic@msu.edu";
  (
    container.querySelector('input[name="password"]') as HTMLInputElement
  ).value = "Synthetic.test.only!";
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await vi.waitFor(() =>
    expect(container.textContent).toContain(
      "Email or password wasn’t recognized.",
    ),
  );
  expect(container.textContent).toContain("Forgot your password");
  getSupabase().auth.stopAutoRefresh();
});
