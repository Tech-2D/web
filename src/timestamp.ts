// Substitui o Timestamp do SDK do Firestore, que deixou de ser carregado no site.
// O dataClient converte campos terminados em "At" para esta classe, então o
// restante do código continua usando toDate()/toMillis() como antes.
export class Timestamp {
  readonly seconds: number
  readonly nanoseconds: number

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds
    this.nanoseconds = nanoseconds
  }

  static fromMillis(milliseconds: number): Timestamp {
    const seconds = Math.floor(milliseconds / 1000)
    return new Timestamp(seconds, Math.round((milliseconds - seconds * 1000) * 1e6))
  }

  static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime())
  }

  static now(): Timestamp {
    return Timestamp.fromMillis(Date.now())
  }

  toMillis(): number {
    return this.seconds * 1000 + this.nanoseconds / 1e6
  }

  toDate(): Date {
    return new Date(this.toMillis())
  }

  isEqual(other: Timestamp): boolean {
    return other.seconds === this.seconds && other.nanoseconds === this.nanoseconds
  }

  valueOf(): string {
    // Mantém comparações (<, >) e ordenação coerentes, como no SDK original.
    return String(this.seconds + 1e12).padStart(13, '0') + '.' + String(this.nanoseconds).padStart(9, '0')
  }

  toJSON(): { seconds: number; nanoseconds: number } {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds }
  }
}
