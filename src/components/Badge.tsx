import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{ color?: "gray" | "blue" | "green" | "yellow" | "red" }>;

export default function Badge({ children, color = "gray" }: Props) {
  const map = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
  } as const;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[color]}`}>{children}</span>;
}

