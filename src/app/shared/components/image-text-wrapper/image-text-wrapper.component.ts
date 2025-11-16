import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-text-wrapper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-text-wrapper.component.html',
  styleUrl: './image-text-wrapper.component.scss'
})
export class ImageTextWrapperComponent {
  @Input() src: string = '';
  @Input() width: string = '300px';
  @Input() height: string = 'auto';
  @Input() text: string = '';
  @Input() textSize: string = '24px';
  @Input() alt: string = 'Image with text overlay';
}
