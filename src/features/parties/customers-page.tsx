import { useCustomersStore } from "@/stores/parties-store";
import { PartyPage } from "./party-page";

export function CustomersPage() {
  return <PartyPage type="customer" store={useCustomersStore} />;
}