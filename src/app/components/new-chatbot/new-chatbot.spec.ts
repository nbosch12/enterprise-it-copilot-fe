import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewChatbot } from './new-chatbot';

describe('NewChatbot', () => {
  let component: NewChatbot;
  let fixture: ComponentFixture<NewChatbot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewChatbot]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewChatbot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
