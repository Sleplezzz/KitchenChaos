export type PreparationClass = "quick" | "standard";

export type MenuItemId = "smash-burger" | "veggie-bowl" | "loaded-fries";

export type MenuItem = {
  id: MenuItemId;
  name: string;
  preparationClass: PreparationClass;
};

/** Static demo menu. Preparation class drives coordinator priority hints. */
export const MENU: readonly MenuItem[] = [
  {
    id: "smash-burger",
    name: "Smash Burger",
    preparationClass: "quick",
  },
  {
    id: "veggie-bowl",
    name: "Veggie Bowl",
    preparationClass: "standard",
  },
  {
    id: "loaded-fries",
    name: "Loaded Fries",
    preparationClass: "quick",
  },
] as const;
