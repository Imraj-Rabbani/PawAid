import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Icon from "../Icon";
import { Avatar, Badge, Button, Chips, ListBody, Panel, SearchInput, SelectFilter, Toolbar } from "./ui";
import {
  ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, errorMessage, formatDate, optionsFrom, taka, useAdminList, useDebounced,
} from "./adminUtils";

const FILTERS = ["", "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

// the one step forward from each status, matching ORDER_FLOW in the admin controller
const NEXT_STEP = {
  PENDING: { status: "CONFIRMED", label: "Confirm", icon: "check" },
  CONFIRMED: { status: "PROCESSING", label: "Start processing", icon: "inventory_2" },
  PROCESSING: { status: "SHIPPED", label: "Mark shipped", icon: "local_shipping" },
  SHIPPED: { status: "DELIVERED", label: "Mark delivered", icon: "done_all" },
};

const orderNumber = (order) => order.id.slice(0, 8).toUpperCase();
const itemCount = (order) => order.items.reduce((sum, item) => sum + item.quantity, 0);

export default function OrdersTab({ onChange }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = useAdminList("/admin/orders", { search: debouncedSearch, status, paymentMethod });
  const counts = list.body?.counts ?? {};
  const [busyId, setBusyId] = useState(null);

  const changeStatus = async (order, next) => {
    const number = orderNumber(order);
    const cashDue = order.payment?.status === "PENDING";

    if (next === "DELIVERED" && cashDue && !confirm(`Confirm order #${number} was delivered and ${taka(order.totalAmount)} cash was collected?`)) {
      return;
    }
    if (next === "CANCELLED") {
      const refund = order.payment?.status === "COMPLETED"
        ? ` ${taka(order.totalAmount)} will be refunded to ${order.buyer.name}'s wallet.`
        : "";
      if (!confirm(`Cancel order #${number}? Its items go back into stock.${refund}`)) return;
    }

    try {
      setBusyId(order.id);
      await api.patch(`/admin/orders/${order.id}/status`, { status: next });
      // the order may have left the current filter, and the counts have moved
      list.reload();
      onChange();
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Failed to update order"));
      list.reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel title="Orders" description="Move marketplace orders from checkout to the buyer's door.">
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search order #, buyer, recipient or phone" />
        <SelectFilter
          label="Payment method"
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={optionsFrom(PAYMENT_METHOD, "All payments")}
        />
      </Toolbar>

      <div className="mb-4">
        <Chips
          value={status}
          onChange={setStatus}
          options={FILTERS.map((value) => ({
            value,
            label: value ? ORDER_STATUS[value].label : "All",
            count: value ? counts[value] ?? 0 : undefined,
          }))}
        />
      </div>

      <ListBody list={list} empty={status === "PENDING" ? "No orders waiting. All caught up!" : "No orders match these filters."}>
        <ul className="divide-y divide-surface-container-high">
          {list.items.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              busy={busyId === order.id}
              onStatus={(next) => changeStatus(order, next)}
            />
          ))}
        </ul>
      </ListBody>
    </Panel>
  );
}

function OrderRow({ order, busy, onStatus }) {
  const [open, setOpen] = useState(false);
  const next = NEXT_STEP[order.status];
  const closed = !next;
  const count = itemCount(order);

  return (
    <li className={`py-4 ${order.status === "CANCELLED" ? "opacity-70" : ""}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex gap-3 min-w-0 flex-1 text-left"
        >
          <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
            <Icon name="receipt_long" className="text-[22px] text-on-surface-variant" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-on-surface">#{orderNumber(order)}</p>
              <Badge status={ORDER_STATUS[order.status]} />
              <Badge status={PAYMENT_STATUS[order.payment?.status]} />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1">
                <Avatar user={order.buyer} size="w-4 h-4" />
                <span className="font-semibold">{order.buyer.name}</span>
              </span>
              <span>· {count} {count === 1 ? "item" : "items"}</span>
              <span>· {PAYMENT_METHOD[order.paymentMethod]?.label ?? order.paymentMethod}</span>
              <span>· {formatDate(order.createdAt)}</span>
            </p>
          </div>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          <p className="font-display text-lg font-bold text-on-surface tabular-nums">{taka(order.totalAmount)}</p>
          {!closed && (
            <>
              <Button variant="primary" icon={next.icon} disabled={busy} onClick={() => onStatus(next.status)}>
                {next.label}
              </Button>
              <Button variant="danger" icon="close" disabled={busy} onClick={() => onStatus("CANCELLED")}>
                Cancel
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            icon={open ? "expand_less" : "expand_more"}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Hide details" : "Show details"}
          />
        </div>
      </div>

      {open && <OrderDetails order={order} />}
    </li>
  );
}

function OrderDetails({ order }) {
  return (
    <div className="mt-3 md:ml-15 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-container-low text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Items</p>
        <ul className="mt-2 space-y-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <Link to={`/marketplace/${item.product.id}`} className="min-w-0 truncate text-on-surface hover:text-primary">
                {item.product.name}
              </Link>
              <span className="shrink-0 text-on-surface-variant tabular-nums">
                {item.quantity} × {taka(item.unitPrice)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Deliver to</p>
        <p className="mt-2 font-semibold text-on-surface">{order.deliveryName}</p>
        <p className="text-on-surface-variant">{order.deliveryPhone}</p>
        <p className="mt-1 text-on-surface-variant whitespace-pre-line">{order.deliveryAddress}</p>
        <p className="mt-3 text-xs text-on-surface-variant">
          Buyer:{" "}
          <Link to={`/profile/${order.buyer.id}`} className="font-semibold hover:text-primary">
            {order.buyer.name}
          </Link>{" "}
          · {order.buyer.email}
        </p>
        <Link
          to={`/orders/${order.id}`}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-container"
        >
          Open order page
          <Icon name="open_in_new" className="text-[14px]" />
        </Link>
      </div>
    </div>
  );
}
