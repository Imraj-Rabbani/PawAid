import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { useCart } from "./cartContext";

// Checks the cart's products against the server once per visit: prices, stock and
// availability may have changed since they were added. resync() checks them all
// again, for when the server has said the cart is out of date.
export default function useCartSync() {
  const { items, syncProducts } = useCart();
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [round, setRound] = useState(0);
  // products already checked in this round
  const synced = useRef(new Set());

  const idsKey = items.map((item) => item.productId).sort().join(",");

  useEffect(() => {
    const ids = idsKey.split(",").filter((id) => id && !synced.current.has(id));
    if (ids.length === 0) return;
    let ignore = false;
    setSyncing(true);

    api
      .get("/marketplace/products", { params: { ids: ids.join(","), limit: 48 } })
      .then((res) => {
        if (ignore) return;
        ids.forEach((id) => synced.current.add(id));
        syncProducts(res.data.data.filter((product) => ids.includes(product.id)));
        setSyncError("");
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setSyncError("Couldn't check the latest prices and stock. Showing what was saved.");
      })
      .finally(() => {
        if (!ignore) setSyncing(false);
      });

    return () => {
      ignore = true;
    };
  }, [idsKey, syncProducts, round]);

  const resync = () => {
    synced.current = new Set();
    setRound((r) => r + 1);
  };

  return { syncError, syncing, resync };
}
