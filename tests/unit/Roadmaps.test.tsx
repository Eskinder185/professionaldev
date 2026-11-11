import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../src/lib/api/http";
import { listRoadmaps } from "../../src/lib/api/roadmaps";
import type { RoadmapResponse } from "../../src/lib/api/types";
import Roadmaps from "../../src/pages/Resources/Roadmaps";

vi.mock("../../src/lib/api/roadmaps", () => ({
  listRoadmaps: vi.fn(),
}));

const mockedListRoadmaps = vi.mocked(listRoadmaps);

const roadmap: RoadmapResponse = {
  id: "java-spring-backend",
  title: "Java and Spring Backend",
  description: "Progress from Java fundamentals to a tested Spring Boot API.",
  targetRole: "Backend Java Developer",
  estimatedWeeks: 14,
  stages: [
    {
      sequence: 1,
      title: "Modern Java",
      outcomes: ["Model data with records"],
    },
  ],
};

beforeEach(() => {
  mockedListRoadmaps.mockReset();
});

afterEach(cleanup);

describe("Roadmaps API catalog", () => {
  it("shows a loading state", () => {
    mockedListRoadmaps.mockReturnValue(new Promise(() => undefined));

    render(<Roadmaps />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading the Java and Spring roadmap");
  });

  it("renders the Java roadmap returned by the API", async () => {
    mockedListRoadmaps.mockResolvedValue([roadmap]);

    render(<Roadmaps />);

    expect(await screen.findByText(roadmap.description)).toBeVisible();
    expect(screen.getByText("Backend Java Developer")).toBeVisible();
    expect(screen.getByText("Model data with records")).toBeVisible();
  });

  it("shows an empty state when the Java roadmap is absent", async () => {
    mockedListRoadmaps.mockResolvedValue([]);

    render(<Roadmaps />);

    expect(await screen.findByText(/not currently available/)).toBeVisible();
  });

  it("shows an API failure and retries on request", async () => {
    mockedListRoadmaps
      .mockRejectedValueOnce(new ApiClientError("network", "Unable to reach the roadmap API"))
      .mockResolvedValueOnce([roadmap]);

    render(<Roadmaps />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Spring Boot API is unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(roadmap.description)).toBeVisible();
    expect(mockedListRoadmaps).toHaveBeenCalledTimes(2);
  });
});
