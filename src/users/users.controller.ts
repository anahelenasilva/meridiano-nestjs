import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { Public } from '@libs/auth';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { CreateUserDto, UserResponseDto } from './user.entity';
import { UsersService } from './users.service';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiValidationErrorResponse()
  async createUser(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.createUser(
      createUserDto.email,
      createUserDto.username,
      createUserDto.password,
    );

    return new UserResponseDto(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiAuthErrorResponse()
  @ApiNotFoundResponse({ description: 'Invalid user' })
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.getUserById(id);

    if (!user) {
      throw new NotFoundException('Invalid user');
    }

    return new UserResponseDto(user);
  }
}
