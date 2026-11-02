import { groupLabel, type Group } from "./api";

export type DistributionSlice = {
  id: string;
  label: string;
  value: number;
  color: string;
  group?: Group;
};
const sourceColors = ["var(--data)", "var(--data-secondary)", "var(--data-tertiary)"];

// The API returns only the top twelve groups. Include the entire tail in Other,
// so the shares describe all events, not just the visible leaders.
export function sourceDistribution(groups: Group[], total: number): DistributionSlice[] {
  if (!total) return [];
  const slices = groups
    .filter((group) => group.count > 0)
    .slice(0, 3)
    .map((group, index) => ({
      id: JSON.stringify(group.label),
      label: group.display ?? groupLabel(group.label),
      value: group.count,
      color: sourceColors[index],
      group,
    }));
  const remainder = total - slices.reduce((sum, slice) => sum + slice.value, 0);
  return remainder > 0
    ? [
        ...slices,
        { id: "other", label: "Other sources", value: remainder, color: "var(--muted-foreground)" },
      ]
    : slices;
}
