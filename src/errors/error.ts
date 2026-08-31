export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

export class TooManyRequests extends Error{
    constructor(message: string) {
        super(message);
        this.name = 'TooManyRequests';
    }
}

export class PaymentRequired extends Error{
    constructor(message: string) {
        super(message);
        this.name = 'PaymentRequired';
    }
}