import { Global, Module } from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { PagesModule } from '../pages/pages.module';

@Global()
@Module({
  imports: [PagesModule],
  providers: [MessengerService],
  exports: [MessengerService],
})
export class MessengerModule {}
