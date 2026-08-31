import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BtpChatbot } from './btp-chatbot';

describe('BtpChatbot', () => {
  let component: BtpChatbot;
  let fixture: ComponentFixture<BtpChatbot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BtpChatbot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BtpChatbot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
