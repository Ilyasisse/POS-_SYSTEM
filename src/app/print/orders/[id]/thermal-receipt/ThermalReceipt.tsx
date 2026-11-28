import Image from "next/image";
import type { ReceiptData } from "@/lib/orders/build-receipt-data";

export default function ThermalReceipt({ receipt }: { receipt: ReceiptData }) {
  return (
    <article
      className="thermal-receipt"
      aria-label={`Thermal receipt ${receipt.orderNumber}`}
    >
      <header className="thermal-header thermal-section">
        <Image
          src="/newer_logo.png"
          alt=""
          width={48}
          height={48}
          className="thermal-logo"
          priority
        />
        <h1>{receipt.businessName}</h1>
        <p>Customer receipt</p>
        {receipt.status !== "PAID" ? (
          <p className="thermal-status">
            {receipt.status === "CANCELLED" ? "CANCELLED" : "UNPAID"}
          </p>
        ) : null}
      </header>
      <dl className="thermal-details thermal-section">
        <div>
          <dt>Order / receipt</dt>
          <dd>#{receipt.orderNumber}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{receipt.dateTime}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{receipt.type}</dd>
        </div>
        <div>
          <dt>Table / check</dt>
          <dd>{receipt.tableLabel}</dd>
        </div>
        <div>
          <dt>Served by</dt>
          <dd>{receipt.servedBy}</dd>
        </div>
      </dl>
      <section className="thermal-items thermal-section" aria-label="Items">
        {receipt.items.map((item) => (
          <div key={item.position} className="thermal-item">
            <div className="thermal-item-line">
              <span>{item.quantity}×</span>
              <span className="thermal-item-name">{item.name}</span>
              <span className="thermal-amount">{item.lineTotal}</span>
            </div>
            <p className="thermal-item-detail">
              {item.quantity} @ {item.unitPrice}
            </p>
            {item.modifiers.length ? (
              <p className="thermal-item-detail">{item.modifiers.join(", ")}</p>
            ) : null}
          </div>
        ))}
      </section>
      <section className="thermal-totals thermal-section" aria-label="Totals">
        <div className="thermal-row">
          <span>Subtotal</span>
          <span className="thermal-amount">{receipt.subtotal}</span>
        </div>
        {receipt.reductions.map((adjustment) => (
          <div key={adjustment.position} className="thermal-row">
            <span>{adjustment.label}</span>
            <span className="thermal-amount">{adjustment.amount}</span>
          </div>
        ))}
        <div className="thermal-row thermal-total">
          <span>Total</span>
          <span className="thermal-amount">{receipt.total}</span>
        </div>
        <div className="thermal-row">
          <span>Paid</span>
          <span className="thermal-amount">{receipt.paid}</span>
        </div>
        {receipt.refunded ? (
          <div className="thermal-row">
            <span>Refunded</span>
            <span className="thermal-amount">{receipt.refunded}</span>
          </div>
        ) : null}
      </section>
      {receipt.payments.length ? (
        <section className="thermal-section" aria-label="Payments">
          <h2>Payments</h2>
          {receipt.payments.map((payment) => (
            <div key={payment.position} className="thermal-payment">
              <div className="thermal-row">
                <span>{payment.method}</span>
                <span className="thermal-amount">{payment.amount}</span>
              </div>
              {payment.reference ? (
                <p className="thermal-reference">Ref: {payment.reference}</p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {receipt.notes ? (
        <section className="thermal-section thermal-note">
          <h2>Order note</h2>
          <p>{receipt.notes}</p>
        </section>
      ) : null}
      <footer className="thermal-footer">
        <p>
          <strong>Thank you for visiting!</strong>
        </p>
        <p>Receipt #{receipt.orderNumber}</p>
      </footer>
    </article>
  );
}
