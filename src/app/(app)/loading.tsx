import { BrandLoader } from "@/components/loader/brand-loader";

export default function Loading() {
  return <BrandLoader variant="panel" messages={["Loading your workspace", "Gathering invoices", "Preparing analytics"]} />;
}
