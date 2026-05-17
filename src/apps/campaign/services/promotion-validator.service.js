const PPC_DEPRECATION_ERROR = Object.freeze({
  status: 410,
  message: "Manual proof validation and payout are no longer available for PPC campaigns.",
});

const throwPpcDeprecationError = () => {
  throw { ...PPC_DEPRECATION_ERROR };
};

export async function handlePromotionValidation() {
  throwPpcDeprecationError();
}

export async function validatePromotion() {
  throwPpcDeprecationError();
}

export async function rejectPromotion() {
  throwPpcDeprecationError();
}
