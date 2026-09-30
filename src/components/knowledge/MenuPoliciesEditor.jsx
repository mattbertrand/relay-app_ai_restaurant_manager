import React from "react";
import { SwitchField, TextField, TextAreaField } from "./Fields";

// Menu and offerings, policies / FAQ answers, and anything else the manager
// wants Relay to know. Relay uses only what is actually entered here.
// `part` controls which half renders — "all" (default), "menu" (Food &
// Beverage group) or "policies" (Customers group) — so the same editor backs
// both profile sections without duplicating it.
export default function MenuPoliciesEditor({ value, onChange, part = "all" }) {
  const m = value.menu || {};
  const p = value.policies || {};
  const setMenu = (patch) => onChange({ ...value, menu: { ...m, ...patch } });
  const setPolicy = (patch) => onChange({ ...value, policies: { ...p, ...patch } });
  const showMenu = part === "all" || part === "menu";
  const showPolicies = part === "all" || part === "policies";
  const showOther = part === "all" || part === "policies";

  return (
    <div className="space-y-8">
      {showMenu && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Menu & offerings</h3>
          <TextAreaField
            label="Menu summary"
            value={m.summary}
            onChange={(v) => setMenu({ summary: v })}
            placeholder="e.g. Seasonal California menu, wood-fired dishes, full bar"
            rows={2}
          />
          <div className="grid sm:grid-cols-2 gap-x-6">
            <SwitchField label="Vegetarian options" checked={!!m.vegetarian} onChange={(v) => setMenu({ vegetarian: v })} />
            <SwitchField label="Vegan options" checked={!!m.vegan} onChange={(v) => setMenu({ vegan: v })} />
            <SwitchField label="Gluten-free options" checked={!!m.gluten_free} onChange={(v) => setMenu({ gluten_free: v })} />
            <SwitchField label="Children's menu" checked={!!m.kids_menu} onChange={(v) => setMenu({ kids_menu: v })} />
            <SwitchField label="Takeout" checked={!!m.takeout} onChange={(v) => setMenu({ takeout: v })} />
            <SwitchField label="Delivery" checked={!!m.delivery} onChange={(v) => setMenu({ delivery: v })} />
            <SwitchField label="Gift cards" checked={!!m.gift_cards} onChange={(v) => setMenu({ gift_cards: v })} />
            <SwitchField label="Loyalty program" checked={!!m.loyalty_program} onChange={(v) => setMenu({ loyalty_program: v })} />
          </div>
          <TextField
            label="Common allergens"
            value={m.allergens}
            onChange={(v) => setMenu({ allergens: v })}
            placeholder="e.g. Nuts in several dishes; kitchen is not allergen-free"
          />
          <TextAreaField
            label="Special dietary accommodations"
            value={m.dietary_accommodations}
            onChange={(v) => setMenu({ dietary_accommodations: v })}
            placeholder="e.g. Kitchen can adapt most dishes; tell us when booking"
          />
        </div>
      )}

      {showPolicies && (
        <div className={showMenu ? "space-y-4 border-t border-border pt-6" : "space-y-4"}>
          <h3 className="text-sm font-semibold text-foreground">Policies & common questions</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <TextField label="Dress code" value={p.dress_code} onChange={(v) => setPolicy({ dress_code: v })} />
            <TextField label="Pet policy" value={p.pet_policy} onChange={(v) => setPolicy({ pet_policy: v })} />
            <TextField label="Parking" value={p.parking} onChange={(v) => setPolicy({ parking: v })} placeholder="e.g. Valet after 6 PM; street parking" />
            <TextField label="Accessibility" value={p.accessibility} onChange={(v) => setPolicy({ accessibility: v })} />
            <TextField label="Outside food/drinks" value={p.outside_food_drinks} onChange={(v) => setPolicy({ outside_food_drinks: v })} />
            <TextField label="Age restrictions" value={p.age_restrictions} onChange={(v) => setPolicy({ age_restrictions: v })} />
          </div>
          <TextField label="Birthday policy" value={p.birthday_policy} onChange={(v) => setPolicy({ birthday_policy: v })} />
          <TextField label="Cake policy" value={p.cake_policy} onChange={(v) => setPolicy({ cake_policy: v })} />
          <TextField label="Decorations" value={p.decorations} onChange={(v) => setPolicy({ decorations: v })} />
          <TextAreaField
            label="Other policies / FAQ answers"
            value={p.other}
            onChange={(v) => setPolicy({ other: v })}
            placeholder="Anything customers regularly ask that Relay should know the answer to"
          />
        </div>
      )}

      {showOther && (
        <div className="border-t border-border pt-6">
          <TextAreaField
            label="Other information Relay should know about this restaurant"
            value={value.other_info}
            onChange={(v) => onChange({ ...value, other_info: v })}
            placeholder="Anything that doesn't fit the sections above"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}