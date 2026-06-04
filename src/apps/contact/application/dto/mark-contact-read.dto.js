export class MarkContactReadDto {
  constructor({ id }) {
    this.id = id;
  }

  static fromRequest({ params }) {
    return new MarkContactReadDto({
      id: params?.id,
    });
  }
}
