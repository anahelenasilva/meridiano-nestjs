import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post
} from '@nestjs/common';
import { Public } from '../../libs/auth/decorators/public.decorator';
import { CreateUserDto, UserResponseDto } from './user.entity';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Public()
  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(
      createUserDto.email,
      createUserDto.username,
      createUserDto.password,
    );

    return new UserResponseDto(user);
  }

  @Get(':id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.getUserById(id);

    if (!user) {
      throw new NotFoundException('Invalid user');
    }

    return new UserResponseDto(user);
  }
}
