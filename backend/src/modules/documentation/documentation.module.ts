import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Documentation, DocumentationSchema } from '../../schemas/documentation.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { DocumentationService } from './documentation.service';
import { DocumentationController } from './documentation.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Documentation.name, schema: DocumentationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DocumentationController],
  providers: [DocumentationService],
  exports: [DocumentationService],
})
export class DocumentationModule {}
