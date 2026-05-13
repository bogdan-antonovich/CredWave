import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ContactForm {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}
