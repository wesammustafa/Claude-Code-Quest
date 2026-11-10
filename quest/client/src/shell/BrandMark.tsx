import { useSlots } from "../mount/context";
import { Pip } from "../pip/Pip";

/** The brand in the top bar: Pip's icon and the app's name, or the mount's own mark and title. */
export function BrandMark() {
  const { brand } = useSlots();
  return (
    <span className="inline-flex items-center gap-2.5" data-brand="">
      {brand ? <brand.mark /> : <Pip size="icon" />}
      <span className="text-control font-bold tracking-tight max-sm:sr-only">
        {brand ? brand.title : "Claude Code Quest"}
      </span>
    </span>
  );
}
