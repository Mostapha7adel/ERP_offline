import { useSuppliersStore } from "@/stores/parties-store";
import { PartyPage } from "./party-page";

export function SuppliersPage() {
  return <PartyPage type="supplier" store={useSuppliersStore} />;
}