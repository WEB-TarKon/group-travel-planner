import { registerAs } from '@nestjs/config';
import { StringValue } from 'ms';

export default registerAs('jwt', () => ({
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN as StringValue,
}));
