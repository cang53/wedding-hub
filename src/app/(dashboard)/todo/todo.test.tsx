import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { TodoRow } from "@/types/db";

import { TodoClient } from "./todo-client";

vi.mock("./actions", () => ({
  createTodo: vi.fn(),
  deleteTodo: vi.fn(),
  toggleTodo: vi.fn(),
  updateTodo: vi.fn(),
}));

// Mock Supabase browser client used for realtime subscriptions.
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
    }),
    removeChannel: () => {},
  }),
}));

const { deleteTodo, toggleTodo } = await import("./actions");

describe("TodoClient optimistic updates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // auto-confirm delete dialogs
    vi.stubGlobal("confirm", () => true);
    // Actions resolve to {} on success — the client destructures `error`.
    vi.mocked(deleteTodo).mockResolvedValue({});
    vi.mocked(toggleTodo).mockResolvedValue({});
  });

  it("optimistically removes a todo when deleted", async () => {
    const todos: TodoRow[] = [
      {
        id: "1",
        text: "First",
        category: "wedding",
        priority: "medium",
        done: false,
        due_date: null,
        updated_at: "",
        created_at: "",
      },
      {
        id: "2",
        text: "Second",
        category: "home",
        priority: "low",
        done: false,
        due_date: null,
        updated_at: "",
        created_at: "",
      },
    ];

    render(<TodoClient initialTodos={todos} />);

    expect(screen.getByText("First")).toBeInTheDocument();

    const deleteButtons = screen.getAllByText("Delete");
    await userEvent.click(deleteButtons[0]);

    // Optimistic remove: item should no longer be in the document
    expect(screen.queryByText("First")).toBeNull();
    await waitFor(() => {
      expect(deleteTodo).toHaveBeenCalledWith("1");
    });
  });

  it("optimistically toggles done state", async () => {
    const todos: TodoRow[] = [
      {
        id: "3",
        text: "Toggle me",
        category: "personal",
        priority: "low",
        done: false,
        due_date: null,
        updated_at: "",
        created_at: "",
      },
    ];

    render(<TodoClient initialTodos={todos} />);

    const checkbox = screen.getByLabelText("Mark as done") as HTMLInputElement;
    await userEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    await waitFor(() => {
      expect(toggleTodo).toHaveBeenCalledWith("3", true);
    });
  });

  it("restores the todo and shows the error when the delete fails", async () => {
    vi.mocked(deleteTodo).mockResolvedValue({ error: "network is down" });

    const todos: TodoRow[] = [
      {
        id: "4",
        text: "Keep me",
        category: "wedding",
        priority: "high",
        done: false,
        due_date: null,
        updated_at: "",
        created_at: "",
      },
    ];

    render(<TodoClient initialTodos={todos} />);

    await userEvent.click(screen.getByText("Delete"));

    // Optimistically removed, then put back once the action reports failure.
    await waitFor(() => {
      expect(screen.getByText("Keep me")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("network is down");
  });

  it("reverts the checkbox when the toggle fails", async () => {
    vi.mocked(toggleTodo).mockResolvedValue({ error: "write rejected" });

    const todos: TodoRow[] = [
      {
        id: "5",
        text: "Toggle me back",
        category: "personal",
        priority: "low",
        done: false,
        due_date: null,
        updated_at: "",
        created_at: "",
      },
    ];

    render(<TodoClient initialTodos={todos} />);

    const checkbox = screen.getByLabelText("Mark as done") as HTMLInputElement;
    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("write rejected");
  });
});
